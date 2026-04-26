# 视频压缩器

[![Build Windows EXE](https://github.com/mattdog2024/MP4Compressor-2/actions/workflows/build.yml/badge.svg)](https://github.com/mattdog2024/MP4Compressor-2/actions/workflows/build.yml)

一款基于 Electron + FFmpeg 的 Windows 视频压缩工具，界面现代简洁，支持批量压缩。

## 功能特性

- 支持 MP4、MKV、AVI、MOV、WMV、FLV、WEBM 格式
- 现代明亮主题界面，支持拖拽上传
- GPU 硬件加速（NVIDIA / AMD / Intel）
- 质量预设：高质量 / 均衡 / 极压缩
- 输出分辨率自定义（保持原始 / 1080p / 720p / 480p / 360p）
- 跳过片头 / 片尾（自定义秒数）
- MKV 内置字幕烧录（可选择字幕轨道）
- 批量压缩 + 并发处理（可设置同时压缩数量）
- 停止压缩功能

## 下载使用

前往 [Releases](https://github.com/mattdog2024/MP4Compressor-2/releases) 页面下载最新版 `VideoCompressor.exe`，双击运行即可，无需安装任何环境。

## 自动打包

本项目配置了 GitHub Actions，有两种方式触发自动打包：

**方式一：推送版本 Tag（推荐，会自动创建 Release）**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**方式二：在 GitHub 网页手动触发**

进入仓库 → Actions → Build Windows EXE → Run workflow

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发模式（需要本地有 resources/ffmpeg.exe 和 resources/ffprobe.exe）
npm start

# 打包 exe
npm run build
```

> 本地打包需要先把 `ffmpeg.exe` 和 `ffprobe.exe` 放到 `resources/` 目录中。

## 技术栈

- [Electron](https://www.electronjs.org/) v28
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
- [electron-builder](https://www.electron.build/)
- FFmpeg（自动下载，不包含在仓库中）
