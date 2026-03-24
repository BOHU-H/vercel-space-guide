my-3d-project/
│
├── index.html         # 由原来的 tan.html 重命名而来（Vercel 默认入口）
├── tan.js             # 你的 Three.js 核心逻辑代码
├── sw.js              # Service Worker 文件（代码里有注册逻辑，建议建一个空的避免 404）
│
├── MODEL/             # 存放 3D 模型的文件夹
│   ├── robot.glb      # 机器人模型
│   └── star.glb       # 星星模型
│
└── vercel.json        # (可选) Vercel 配置文件，用于优化路由或缓存
