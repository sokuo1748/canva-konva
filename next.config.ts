import type { NextConfig } from "next";

// 只有在 GitHub Actions 環境才套用 basePath/assetPrefix，本機 dev/build 路徑維持現狀不受影響
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";

const nextConfig: NextConfig = {
  // 靜態匯出成 out/，交給 GitHub Pages 這類純靜態主機服務
  output: "export",
  ...(isGithubActions && {
    basePath: `/${repoName}`,
    assetPrefix: `/${repoName}/`,
  }),
};

export default nextConfig;
