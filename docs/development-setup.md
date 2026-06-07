# 开发环境配置指南

本文档将指导你配置 huyang_system 项目的开发环境，包括前端（Node.js + pnpm）和后端（Python + mamba）环境。支持 Windows、macOS 和 Linux 系统。

## 前置要求

- 终端访问权限（Windows 用户可使用 PowerShell 或 Git Bash）
- Git 已安装

## 第一部分：前端环境配置（Node.js + pnpm）

### 1.1 安装 pnpm

pnpm 是一个快速、节省磁盘空间的包管理器。本项目使用 pnpm 管理前端依赖。

#### 方法一：使用 npm 安装（推荐，需要已有 Node.js）

```bash
# 如果已有 Node.js（任意版本），可以通过 npm 安装 pnpm
npm install -g pnpm
```

#### 方法二：使用独立脚本安装（无需预先安装 Node.js）

**macOS/Linux:**

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

**Windows (PowerShell):**

```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

#### 方法三：使用 Homebrew (macOS)

```bash
brew install pnpm
```

#### 方法四：使用 Scoop (Windows)

```powershell
scoop install nodejs-lts pnpm
```

安装完成后，重新启动终端或运行 `source ~/.zshrc`（macOS/Linux）或重新打开 PowerShell（Windows），然后验证安装：

```bash
pnpm --version
```

### 1.2 使用 pnpm 安装和管理 Node.js

pnpm 内置了 Node.js 版本管理功能，可以轻松安装和切换 Node.js 版本。

**注意**：在 Windows 上，如果遇到权限问题，请以管理员身份运行 PowerShell。

**安装 Node.js LTS 版本（推荐）：**

```bash
pnpm env use --global lts
```

**验证 Node.js 安装：**

```bash
node --version
npm --version
```

**查看已安装的 Node.js 版本：**

```bash
pnpm env list
```

### 1.3 配置前端项目

```bash
# 进入项目前端目录
cd frontend

# 安装依赖
pnpm install

# 验证安装
pnpm --version
node --version
```

### 1.4 启动前端开发服务器

```bash
# 在 frontend 目录下
pnpm dev
```

前端服务将在 `http://127.0.0.1:5173` 启动（默认端口）。

### 1.5 常用前端命令

```bash
# 开发服务器
pnpm dev

# 类型检查
pnpm typecheck

# 快速构建生产版本
pnpm build

# 发布/CI 构建验证（类型检查 + 生产构建）
pnpm run build:verify

# 代码格式化
pnpm format

# 代码检查
pnpm lint

# 运行测试
pnpm test
```

## 第二部分：后端环境配置（Python + mamba）

### 2.1 安装 Miniforge（推荐）

Miniforge 是一个轻量级的 conda 安装程序，包含 conda 和 mamba 包管理器。

#### 方法一：使用 Homebrew 安装 (macOS)

```bash
brew install miniforge
```

#### 方法二：使用 Scoop 安装 (Windows)

```powershell
scoop install miniforge
```

#### 方法三：手动安装（所有平台）

**macOS/Linux:**

```bash
# 下载安装脚本
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-$(uname)-$(uname -m).sh"

# 运行安装脚本
bash Miniforge3-$(uname)-$(uname -m).sh

# 按照提示完成安装，建议选择：
# - 安装到默认位置
# - 初始化 conda（选择 Yes）

# 重新加载 shell 配置
source ~/.zshrc  # 或 source ~/.bashrc
```

**Windows:**

1. 从 [Miniforge 发布页面](https://github.com/conda-forge/miniforge/releases/latest) 下载 `Miniforge3-Windows-x86_64.exe`
2. 运行安装程序，按照提示完成安装
3. 打开 Anaconda Prompt 或 PowerShell

#### 方法四：使用 Micromamba（轻量级替代方案）

如果你只需要 mamba 而不需要完整的 conda：

**macOS/Linux:**

```bash
# 安装 micromamba
curl -Ls https://micro.mamba.pm/api/micromamba/osx-64/latest | tar -xvj bin/micromamba
# 或 Linux:
# curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba

# 移动到 PATH 目录
sudo mv bin/micromamba /usr/local/bin/

# 初始化 shell
micromamba shell init -s zsh -p ~/micromamba
# 或 bash:
# micromamba shell init -s bash -p ~/micromamba

# 重新加载 shell 配置
source ~/.zshrc
```

**Windows (PowerShell):**

```powershell
# 安装 micromamba
Invoke-WebRequest -Uri https://micro.mamba.pm/api/micromamba/win-64/latest -OutFile micromamba.tar.bz2
tar -xvjf micromamba.tar.bz2

# 移动到合适位置（例如 C:\micromamba）
Move-Item -Path .\Library\bin\micromamba.exe -Destination C:\micromamba\micromamba.exe

# 添加到 PATH 环境变量
$env:PATH += ";C:\micromamba"

# 初始化 shell
micromamba shell init -s powershell -p $HOME\micromamba

# 重新加载配置
. $PROFILE
```

### 2.2 配置 Python 环境

**注意**：本项目使用 Python 3.14（在 `environment.yml` 中指定）。请确保你的 mamba/conda 能够解析该版本。

```bash
# 进入后端目录
cd backend

# 使用 environment.yml 创建环境
mamba env create -f environment.yml

# 或者使用 conda（如果使用 miniforge）
conda env create -f environment.yml

# 激活环境
mamba activate geomanager

# 或者使用 conda
conda activate geomanager

# 验证安装
python --version  # 应该显示 Python 3.14.x
pip list
```

**如果使用 micromamba**，创建环境的命令略有不同：

```bash
# 使用 micromamba 创建环境
micromamba create -f environment.yml

# 激活环境
micromamba activate geomanager
```

### 2.3 验证后端环境

```bash
# 确保在 geomanager 环境中
mamba activate geomanager

# 测试 Django 是否可用
python -c "import django; print(django.get_version())"

# 测试 GDAL 是否可用
python -c "from osgeo import gdal; print(gdal.VersionInfo())"

# 测试 GeoPandas 是否可用
python -c "import geopandas; print(geopandas.__version__)"
```

### 2.4 启动后端开发服务器

```bash
# 确保在 geomanager 环境中
mamba activate geomanager

# 进入后端目录（如果尚未进入）
cd backend

# 运行数据库迁移
python manage.py migrate --config ../config/app.test.toml

# 创建超级用户（可选）
python manage.py createsuperuser

# 启动开发服务器
python manage.py runserver 127.0.0.1:8000 --config ../config/app.test.toml
```

后端服务将在 `http://127.0.0.1:8000` 启动。

## 第三部分：环境验证

### 3.1 验证前端环境

```bash
# 进入前端目录
cd frontend

# 运行开发服务器
pnpm dev

# 在浏览器中访问 http://127.0.0.1:5173
```

### 3.2 验证后端环境

```bash
# 激活环境
mamba activate geomanager

# 进入后端目录
cd backend

# 运行开发服务器
python manage.py runserver --config ../config/app.test.toml

# 在浏览器中访问 http://127.0.0.1:8000
```

## 第四部分：常见问题解决

### 4.1 pnpm 安装失败

```bash
# 清除缓存
pnpm store prune

# 重新安装
rm -rf node_modules
pnpm install
```

### 4.2 mamba/conda 环境创建失败

```bash
# 更新 mamba
mamba update -n base -c conda-forge mamba

# 清除缓存
mamba clean --all

# 重新创建环境
mamba env create -f environment.yml
```

### 4.3 GDAL 相关错误

如果遇到 GDAL 相关的错误，确保：

1. 环境已正确激活
2. GDAL 版本与系统版本兼容
3. 尝试重新安装 GDAL：
   ```bash
   mamba install -c conda-forge gdal
   ```

### 4.4 权限问题

如果遇到权限错误，不要使用 `sudo` 运行 pnpm 或 mamba。检查安装路径是否正确。

### 4.5 Windows 特定问题

1. **长路径支持**：Windows 默认路径长度限制 260 字符，可能导致问题。启用长路径支持：
   - 以管理员身份运行 PowerShell
   - 运行：`New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force`

2. **执行策略限制**：如果 PowerShell 脚本无法运行：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

## 第五部分：TOML 配置

### 5.1 Mapbox GL JS Token

前端地图功能需要 Mapbox Access Token。将 token 写入 TOML 配置：

```toml
[application.map]
mapbox_access_token = "your_mapbox_token_here"
```

你可以从 [Mapbox 官网](https://account.mapbox.com/) 获取免费的 access token。

### 5.2 Django 密钥

Django `SECRET_KEY` 由后端自动生成，并持久化到业务数据目录的 `database/.secret_key`。不要在 TOML 配置或前端页面中填写该密钥。

## 附录：项目结构

```
huyang_system/
├── frontend/          # 前端代码（React + Vite）
│   ├── package.json   # 前端依赖配置
│   └── ...
├── backend/           # 后端代码（Django）
│   ├── environment.yml # Python 环境配置
│   └── ...
├── docs/              # 项目文档
└── ...
```

## 获取帮助

如果遇到问题，请：

1. 检查本文档的常见问题部分
2. 查看项目 README.md
3. 搜索相关错误信息
4. 联系项目维护者

---

**注意**：本文档支持 Windows、macOS 和 Linux 系统。不同系统的命令可能略有差异，请根据实际情况调整。
