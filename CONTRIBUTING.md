# 参与 XpandMax / Contributing

欢迎提交问题、修复、文档改进和 Pull Request。项目使用 [MIT 许可证](LICENSE)。优先把一个小功能做好；较大的功能或权限变更请先开 Issue 讨论。

## 本地开发

需要 Node.js 22+、Python 3.9+ 和桌面版 Chrome。插件运行时没有第三方依赖，无需 API Key 或发布凭证。

1. Fork [本仓库](https://github.com/yiren-ai/xpandmax)，克隆你的 Fork。
2. 从 `main` 创建工作分支，例如 `git switch -c fix/profile-label`。
3. 安装测试依赖并运行检查：

```sh
npm ci --ignore-scripts
npm test
python3 -m unittest discover -s tests -p '*_test.py'
npm run package
```

4. 打开 `chrome://extensions`，开启开发者模式，加载仓库中的 `extension/` 目录。
5. 修改代码后，在扩展管理页重新加载插件，再刷新 X 页面。验证受影响的页面与开关；浏览器翻译能力不可用时应保留原文。

## 代码位置

- `extension/`：Manifest V3 插件、页面数据读取、展示、设置和本地翻译。
- `tests/`：Node.js 行为测试与 Python 打包测试。
- `scripts/`：打包、官网构建和维护者使用的商店发布工具。
- `website/`：官网；`store/`：商店介绍和演示素材。

`npm run package` 生成手动安装包；`npm run package:store` 仅生成商店格式的 ZIP。贡献者不需要运行商店提交命令，也不需要发布账号。

## 提交 Pull Request

提交前运行 `git var GIT_AUTHOR_IDENT` 和 `git var GIT_COMMITTER_IDENT`，确认署名正确。作者邮箱应关联到你的 GitHub 账号；不想公开私人邮箱时，可使用 GitHub 邮箱设置页提供的 `noreply` 地址。这样提交合并到默认分支后，GitHub 才能将贡献关联到你的账号；贡献者统计可能延迟更新。

将分支推送到你的 Fork，向本仓库的 `main` 发起 PR。说明解决了什么问题、如何验证；界面变化请附使用虚构数据的截图。一次 PR 尽量只解决一个问题。涉及行为修改时补充有意义的测试，纯文档修改无需新增测试。

请勿提交 `.env`、密钥、令牌、Cookie、真实账号响应、私信或浏览记录。测试使用合成数据；构建包、依赖和本机发布回执不提交到仓库。保留现有的最小权限和本地数据处理方式。

PR 会自动运行测试。维护者审核后合并；合并代码与 Chrome 商店发布是两个独立步骤。

## English

Contributions are welcome under the MIT license. Fork this repository, create a branch from `main`, and open a pull request back to `main`. Use Node.js 22+ and Python 3.9+, then run the checks above. Load `extension/` as an unpacked Chrome extension for manual verification.

Before committing, check `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT`. Use an author email linked to your GitHub account, or the `noreply` address from your GitHub email settings to keep your personal email private. This lets GitHub attribute commits to your account after they reach the default branch; contributor statistics may take time to update.

Keep each PR focused. Explain the problem, your change, and verification results. Include synthetic-data screenshots for UI changes and meaningful tests for behavior changes. Discuss large features or permission changes in an issue first. Never commit credentials or private user data. Store publishing credentials are not required to contribute.
