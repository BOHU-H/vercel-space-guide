import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls;
let robotMixer;
let starMixer; // 替换了 goldfishMixer
let starModel; // 替换了 goldfishModel
let starsGroup;
let starsMesh;
const clock = new THREE.Clock();

const config = {
    starCount: 150, 
    starModelPathRadius: 12, // 替换了 goldfishPathRadius
    starModelMoveSpeed: 0.5, // 替换了 goldfishSwimSpeed
    bgStarRotationSpeed: 0.05, 
    robotScale: 1,
    starModelScale: 2 // 替换了 goldfishScale
};

// --- 星星着色器定义 ---
const starVertexShader = `
    attribute float size;
    attribute float blinkSpeed;
    attribute float offset;
    attribute vec3 customColor;
    varying vec3 vColor;
    uniform float time;
    
    void main() {
        vColor = customColor;
        // GPU 计算闪烁效果
        float currentSize = size * (0.6 + 0.4 * sin(time * blinkSpeed + offset));
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = currentSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const starFragmentShader = `
    varying vec3 vColor;
    
    void main() {
        // 绘制圆形并发光
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0 - (dist * 2.0));
    }
`;

init();
animate();

function init() {
    const container = document.getElementById('webgl-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 20);

    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00ffff, 2, 50);
    pointLight.position.set(-5, 10, -5);
    scene.add(pointLight);

    const planeGeo = new THREE.PlaneGeometry(200, 200);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.5 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    createStars();
    loadModels();

    window.addEventListener('resize', onWindowResize, { passive: true });
}

function createStars() {
    starsGroup = new THREE.Group();
    scene.add(starsGroup);

    const positions = [];
    const colors = [];
    const sizes = [];
    const blinkSpeeds = [];
    const offsets = [];

    const colorPalette = [
        new THREE.Color(0xffffff),
        new THREE.Color(0xffffaa),
        new THREE.Color(0xaaddff),
        new THREE.Color(0xffaaff)
    ];

    for (let i = 0; i < config.starCount; i++) {
        const radius = 25 + Math.random() * 25;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = Math.abs(radius * Math.sin(phi) * Math.sin(theta));
        const z = radius * Math.cos(phi);

        positions.push(x, y, z);

        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors.push(color.r, color.g, color.b);

        sizes.push(1.5 + Math.random() * 2.0); 
        blinkSpeeds.push(1 + Math.random() * 3);
        offsets.push(Math.random() * Math.PI * 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('blinkSpeed', new THREE.Float32BufferAttribute(blinkSpeeds, 1));
    geometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    starsMesh = new THREE.Points(geometry, material);
    starsGroup.add(starsMesh);
}

function loadModels() {
    const manager = new THREE.LoadingManager();
    const progressText = document.getElementById('progress-text');
    const loadingScreen = document.getElementById('loading-screen');
    const errorDiv = document.getElementById('error-message');

    manager.onError = function (url) {
        console.error('加载失败:', url);
        if (progressText) {
            progressText.innerText = '加载失败';
        }
        if (errorDiv) {
            errorDiv.textContent = '无法加载模型！由于浏览器安全限制，请勿直接双击 HTML 文件。请使用 VS Code 的 Live Server 插件或本地服务器运行此页面。';
            errorDiv.classList.add('visible');
            const spinner = document.querySelector('.spinner');
            if(spinner) spinner.style.display = 'none';
        }
    };

    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
        const percent = Math.floor((itemsLoaded / itemsTotal) * 100);
        if (progressText && !errorDiv.classList.contains('visible')) {
            progressText.innerText = `加载中... ${percent}%`;
        }
    };

    manager.onLoad = function () {
        if (loadingScreen && !errorDiv.classList.contains('visible')) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { 
                loadingScreen.style.display = 'none'; 
            }, 800);
        }
    };

    const loader = new GLTFLoader(manager);

    loader.load('https://oss-pai-lw2q5x1l0no0xfqpj2-cn-hangzhou.oss-cn-hangzhou.aliyuncs.com/robot.glb', 
        (gltf) => {
            const robot = gltf.scene;
            robot.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            robot.position.set(0, 0, 0);
            robot.scale.set(config.robotScale, config.robotScale, config.robotScale);
            scene.add(robot);

            if (gltf.animations && gltf.animations.length > 0) {
                robotMixer = new THREE.AnimationMixer(robot);
                gltf.animations.forEach((clip) => {
                    const action = robotMixer.clipAction(clip);
                    action.play();
                });
            }
        }, 
        (xhr) => {
            if (xhr.total > 0 && progressText && !errorDiv.classList.contains('visible')) {
                const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                progressText.innerText = `加载Robot... ${percent}%`;
            }
        },
        undefined
    );

    // 修改为加载 star.glb
    loader.load('https://oss-pai-lw2q5x1l0no0xfqpj2-cn-hangzhou.oss-cn-hangzhou.aliyuncs.com/star.glb',
        (gltf) => {
            starModel = gltf.scene;
            starModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });
            
            starModel.position.set(0, 10, 0);
            starModel.scale.set(config.starModelScale, config.starModelScale, config.starModelScale);
            scene.add(starModel);

            if (gltf.animations && gltf.animations.length > 0) {
                starMixer = new THREE.AnimationMixer(starModel);
                gltf.animations.forEach((clip) => {
                    const action = starMixer.clipAction(clip);
                    action.play();
                });
            }
        },
        (xhr) => {
            if (xhr.total > 0 && progressText && !errorDiv.classList.contains('visible')) {
                const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                progressText.innerText = `加载Star模型... ${percent}%`;
            }
        },
        undefined
    );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 修改为控制 Star 模型环绕运动
function updateStarModel(time) {
    if (!starModel) return;

    const pathRadius = config.starModelPathRadius;
    const moveSpeed = config.starModelMoveSpeed;
    
    // 计算当前位置 (圆周运动 + Y轴轻微浮动)
    const currentX = Math.cos(time * moveSpeed) * pathRadius;
    const currentZ = Math.sin(time * moveSpeed) * pathRadius;
    const currentY = 10 + Math.sin(time * moveSpeed * 2) * 2;

    starModel.position.set(currentX, currentY, currentZ);

    // 计算下一个时刻的位置，让模型始终朝向前进方向
    const nextX = Math.cos((time + 0.05) * moveSpeed) * pathRadius;
    const nextZ = Math.sin((time + 0.05) * moveSpeed) * pathRadius;
    const nextY = 10 + Math.sin((time + 0.05) * moveSpeed * 2) * 2;

    starModel.lookAt(nextX, nextY, nextZ);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (robotMixer) {
        robotMixer.update(delta);
    }

    if (starMixer) {
        starMixer.update(delta);
    }

    // 更新星星模型的环绕动画
    updateStarModel(time);
    
    // 背景星空粒子旋转
    if (starsGroup) {
        starsGroup.rotation.y += 0.0005;
    }
    if (starsMesh && starsMesh.material.uniforms) {
        starsMesh.material.uniforms.time.value = time;
    }

    controls.update();
    renderer.render(scene, camera);
}

export function disposeScene() {
    if (!scene) return;

    scene.traverse(object => {
        if (!object.isMesh) return;
        
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => disposeMaterial(material));
            } else {
                disposeMaterial(object.material);
            }
        }
    });

    if (renderer) {
        renderer.dispose();
    }

    if (controls) {
        controls.dispose();
    }

    if (robotMixer) {
        robotMixer.stopAllAction();
    }

    if (starMixer) {
        starMixer.stopAllAction();
    }
}

function disposeMaterial(material) {
    material.dispose();
    
    for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && typeof value === 'object' && 'minFilter' in value) {
            value.dispose();
        }
    }
}

window.addEventListener('beforeunload', disposeScene);