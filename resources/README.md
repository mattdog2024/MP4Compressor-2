# FFmpeg可执行文件说明

此目录需要包含FFmpeg和FFprobe的可执行文件。

## 如何获取FFmpeg

### 方法1：从官方网站下载（推荐）

1. 访问：https://www.gyan.dev/ffmpeg/builds/
2. 下载：`ffmpeg-release-essentials.zip`（共享版本，约60MB）
3. 解压zip文件
4. 从解压后的 `bin/` 目录复制以下文件到此目录：
   - `ffmpeg.exe`
   - `ffprobe.exe`
   - 所有 `.dll` 文件

### 方法2：使用静态构建版本

1. 访问：https://www.gyan.dev/ffmpeg/builds/
2. 下载：`ffmpeg-release-static.zip`（静态版本，约80MB）
3. 解压zip文件
4. 从解压后的 `bin/` 目录复制以下文件到此目录：
   - `ffmpeg.exe`
   - `ffprobe.exe`

### 验证安装

复制完成后，此目录应该包含：
- `ffmpeg.exe` - FFmpeg主程序
- `ffprobe.exe` - FFprobe工具
- 各种 `.dll` 文件（如果使用共享版本）

## 文件大小参考

- ffmpeg.exe: 约50-80MB
- ffprobe.exe: 约10-15MB
- DLL文件: 约5-10MB（共享版本）

## 注意事项

⚠️ **不要将这些exe文件提交到git仓库**
- 它们已在 `.gitignore` 中被忽略
- 文件太大，不适合版本控制
- 应用打包时会自动包含这些文件
