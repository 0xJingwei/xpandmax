# Chrome Web Store API 发布

使用 Google 官方 v2 API，通过专用服务账号发布现有条目 `dckjdeemcnjccfbinnmncalmoajleboo`。默认提交审核，通过后按商店设置发布；不会跳过审核。

## 维护者配置

此工具仅供拥有商店发布权限的维护者使用。普通贡献者无需配置；仓库不包含发布凭证。

- 本机凭证文件：`~/.config/xpandmax/cws-service-account.json`，权限 600，不在仓库中。

## 首次连接

1. 在维护者自己的 Google Cloud 项目启用 Chrome Web Store API。
2. 创建专用服务账号，不授予项目 Owner / Editor 等 Cloud 资源角色。
3. 在 Chrome Web Store 开发者后台左侧 PUBLISHER → Settings 的 Service account 区域绑定该服务账号邮箱。此绑定使账号能够管理发布者名下的条目，需由发布者确认。
4. 从后台 PUBLISHER → Settings 页顶部 Profile 区域取得 Publisher ID（不是扩展 ID，也不是 Cloud 项目 ID）。
5. 经授权后，为服务账号生成 JSON 密钥，保存在本机，不提交到 Git 或聊天。
6. 配置并验证：

```sh
npm run store:configure -- --publisher-id YOUR_PUBLISHER_ID --key-file /absolute/path/to/service-account.json
npm run store:status
```

配置复制到 `~/.config/xpandmax/`，目录权限 700、密钥权限 600。只向 Google 的令牌端点发送签名 JWT，私钥保留在本机；访问令牌只在进程内存中缓存。

## 后续发布

```sh
# 按 extension/manifest.json 的版本重新打包、上传并提交审核
npm run store:submit
# 查询服务器当前发布 / 审核版本
npm run store:status
```

若旧版本正在审核，默认停止。明确需要用当前版本替换旧审核时：

```sh
npm run store:submit -- --replace-pending
```

脚本会校验包版本、等待上传处理完成、提交审核并读回版本状态。重复运行同一已提交版本不会重复上传；已发布版本不再提交。回执位于 `artifacts/cws-releases/`，不包含访问令牌或密钥。

若 Google 要求补全隐私声明、权限理由、商店描述或截图，需在开发者后台完成。v2 API 目前提供包上传、状态查询、提交审核、取消提交和发布比例接口，没有商店文案或截图编辑接口；本项目的对应材料在 `store/listing-zh-CN.txt` 和 `store/screenshot-*.jpg`。

官方文档：
- https://developer.chrome.com/docs/webstore/service-accounts
- https://developer.chrome.com/docs/webstore/api/reference/rest

商店的当前版本和审核状态以维护者实时查询的结果为准；本机回执不提交到仓库。
