/**
 * Helper script to sync local solved problems into a dedicated GitHub repository.
 * Usage:
 *   node scripts/sync-solutions-repo.js <GITHUB_TOKEN> [USERNAME] [REPO_NAME]
 */

const fs = require('fs');
const path = require('path');
const GitHubSync = require('./github.js');

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.log('Usage: node scripts/sync-solutions-repo.js <GITHUB_TOKEN> [USERNAME] [REPO_NAME]');
    console.log('Example: node scripts/sync-solutions-repo.js ghp_xxx AyushSinha2210 LeetCode-Solutions');
    process.exit(1);
  }

  const usernameArg = process.argv[3];
  const repoName = process.argv[4] || 'LeetCode-Solutions';

  const user = await GitHubSync.getUser(token);
  const username = usernameArg || user.login;

  console.log(`[LeetCode Solutions Sync] Connecting to @${username}...`);
  console.log(`[LeetCode Solutions Sync] Target repository: ${username}/${repoName}`);

  await GitHubSync.ensureRepo(token, username, repoName);
  console.log(`[LeetCode Solutions Sync] Repository verified!`);

  const backupDir = path.resolve(__dirname, '../../LeetCode-Solutions/problems');
  if (!fs.existsSync(backupDir)) {
    console.log(`No backup directory found at: ${backupDir}`);
    return;
  }

  const problemFolders = fs.readdirSync(backupDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  console.log(`Found ${problemFolders.length} problem folders to sync.`);

  for (const folder of problemFolders) {
    const fullFolderPath = path.join(backupDir, folder);
    const files = fs.readdirSync(fullFolderPath);

    for (const file of files) {
      const filePath = path.join(fullFolderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const targetRepoPath = `problems/${folder}/${file}`;

      console.log(`Committing: ${targetRepoPath}...`);
      await GitHubSync.commitFile(
        token,
        username,
        repoName,
        targetRepoPath,
        content,
        `chore: migrate ${folder}/${file}`,
        'main'
      ).catch(e => console.warn(`Warning on ${file}:`, e.message));
    }
  }

  console.log('🎉 All problems successfully synced to dedicated repository!');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
