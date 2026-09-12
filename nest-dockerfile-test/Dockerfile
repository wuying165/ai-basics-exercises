# 构建阶段
# 指定基础镜像
FROM node:24.15-alpine AS builder

# 设置容器内工作目录
WORKDIR /app

# 先复制 package.json 利用缓存加速
COPY package*.json ./

# 构建时执行：安装依赖
RUN npm config set registry https://registry.npmmirror.com/
RUN npm install

# 复制项目所有代码到容器内
COPY . .

# 构建 Nest 项目（编译成 JS）
RUN npm run build


# 运行阶段：仅生产依赖 + 编译产物，镜像更小
FROM node:24.15-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com/
RUN npm install --production
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 容器启动时执行的命令
CMD [ "node", "dist/main.js" ]