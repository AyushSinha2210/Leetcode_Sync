/**
 * LeetCode Sync - Page Context Inject Script
 * Runs in the main world page context to intercept network requests (fetch / XHR)
 * and Monaco Editor content directly.
 */

(function () {
  if (window.__LEETCODE_SYNC_INJECTED__) return;
  window.__LEETCODE_SYNC_INJECTED__ = true;

  console.log('[LeetCode Sync] Page context hook initialized.');

  let lastSubmission = {
    code: '',
    lang: '',
    questionId: null,
    slug: '',
    timestamp: 0
  };

  /**
   * Helper to extract slug from URL
   */
  function getCurrentSlug() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : '';
  }

  /**
   * Helper to get Monaco editor content
   */
  function getMonacoCode() {
    try {
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          return models[0].getValue();
        }
      }
    } catch (e) {
      console.warn('[LeetCode Sync] Could not read Monaco editor:', e);
    }
    return '';
  }

  /**
   * Notify content script of Accepted submission
   */
  function emitAccepted(detail) {
    console.log('[LeetCode Sync] Accepted submission detected!', detail);
    window.postMessage(
      {
        type: 'LEETCODE_SYNC_ACCEPTED',
        payload: detail
      },
      '*'
    );
  }

  // 1. Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

    // Check for submit endpoint: /problems/{slug}/submit/
    if (url.includes('/submit/')) {
      try {
        const options = args[1];
        if (options && options.body) {
          const bodyData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
          lastSubmission = {
            code: bodyData.typed_code || getMonacoCode(),
            lang: bodyData.lang || '',
            questionId: bodyData.question_id || null,
            slug: getCurrentSlug(),
            timestamp: Date.now()
          };
          console.log('[LeetCode Sync] Captured submission payload:', {
            lang: lastSubmission.lang,
            slug: lastSubmission.slug,
            codeLength: lastSubmission.code.length
          });
        }
      } catch (err) {
        console.warn('[LeetCode Sync] Error parsing submit request:', err);
      }
    }

    const response = await originalFetch.apply(this, args);

    // Clone response to inspect body without consuming the original stream
    try {
      const clone = response.clone();

      // Check for submission check polling: /submissions/detail/{id}/check/
      if (url.includes('/submissions/detail/') && url.includes('/check/')) {
        clone.json().then(data => {
          if (data && (data.status_msg === 'Accepted' || data.state === 'SUCCESS' && data.status_code === 10)) {
            // Ensure code is populated
            const finalCode = lastSubmission.code || getMonacoCode();
            emitAccepted({
              submissionId: data.submission_id,
              status: data.status_msg || 'Accepted',
              runtime: data.status_runtime || (data.elapsed_time ? `${data.elapsed_time} ms` : ''),
              runtimePercentile: data.runtime_percentile,
              memory: data.status_memory || (data.memory ? `${(data.memory / 1024 / 1024).toFixed(1)} MB` : ''),
              memoryPercentile: data.memory_percentile,
              lang: lastSubmission.lang || data.lang,
              code: finalCode,
              slug: lastSubmission.slug || getCurrentSlug()
            });
          }
        }).catch(() => {});
      }

      // Check for GraphQL submission check
      if (url.includes('/graphql') && response.ok) {
        // Inspect if this was a submission result query
        clone.json().then(data => {
          const detail = data?.data?.submissionDetail || data?.data?.submissionDetails;
          if (detail && detail.statusDisplay === 'Accepted') {
            emitAccepted({
              submissionId: detail.id,
              status: 'Accepted',
              runtime: detail.runtime,
              runtimePercentile: detail.runtimePercentile,
              memory: detail.memory,
              memoryPercentile: detail.memoryPercentile,
              lang: detail.lang?.name || lastSubmission.lang,
              code: detail.code || lastSubmission.code || getMonacoCode(),
              slug: detail.question?.titleSlug || getCurrentSlug()
            });
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore clone/json parse errors
    }

    return response;
  };

  // 2. Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalXhrOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this._url && this._url.includes('/submit/') && body) {
      try {
        const bodyData = typeof body === 'string' ? JSON.parse(body) : body;
        lastSubmission = {
          code: bodyData.typed_code || getMonacoCode(),
          lang: bodyData.lang || '',
          questionId: bodyData.question_id || null,
          slug: getCurrentSlug(),
          timestamp: Date.now()
        };
      } catch (e) {}
    }

    this.addEventListener('load', () => {
      try {
        if (this._url && this._url.includes('/submissions/detail/') && this._url.includes('/check/')) {
          const data = JSON.parse(this.responseText);
          if (data && (data.status_msg === 'Accepted' || data.state === 'SUCCESS' && data.status_code === 10)) {
            emitAccepted({
              submissionId: data.submission_id,
              status: data.status_msg || 'Accepted',
              runtime: data.status_runtime || (data.elapsed_time ? `${data.elapsed_time} ms` : ''),
              runtimePercentile: data.runtime_percentile,
              memory: data.status_memory || (data.memory ? `${(data.memory / 1024 / 1024).toFixed(1)} MB` : ''),
              memoryPercentile: data.memory_percentile,
              lang: lastSubmission.lang || data.lang,
              code: lastSubmission.code || getMonacoCode(),
              slug: lastSubmission.slug || getCurrentSlug()
            });
          }
        }
      } catch (e) {}
    });

    return originalXhrSend.apply(this, arguments);
  };
})();
