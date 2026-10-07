# 跑道笔记 Running‑Notes
几个学生合作的中长跑训练网站项目。
后端 FastAPI，支持 Vercel Serverless 部署；前端原生 HTML/CSS/JS。

> ⚠️ 当前使用内存SQLite，Vercel函数重启，全部打卡数据丢失，仅适合演示。持久化需要切换 PostgreSQL。

## 本地开发运行
1. 安装依赖
```bash
pip install fastapi uvicorn
****# -
