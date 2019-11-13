import THREE from "three";
import createLoop from "canvas-loop";
import Tweenr from "tweenr";
import { parse as getSvgPaths } from "extract-svg-path";
import randomVec3 from "gl-vec3/random";
import triangleCentroid from "triangle-centroid";
import reindex from "mesh-reindex";
import unindex from "unindex-mesh";
import svgMesh3d from "./svgMesh3d";

const createGeom = require("three-simplicial-complex")(THREE);

const tweenr = Tweenr({ defaultEase: "expoOut" });

const vertShader = "attribute vec3 direction;attribute vec3 centroid;uniform float animate;uniform float opacity;uniform float scale;\n#define PI 3.14\nvoid main(){float theta = (1.0 - animate) * (PI * 1.5) * sign(centroid.x);mat3 rotMat = mat3(vec3(cos(theta), 0.0, sin(theta)),vec3(0.0, 1.0, 0.0),vec3(-sin(theta), 0.0, cos(theta)));vec3 offset = mix(vec3(0.0), direction.xyz * rotMat, 1.0 - animate);vec3 tPos = mix(centroid.xyz, position.xyz, scale) + offset;gl_Position=projectionMatrix*modelViewMatrix*vec4(tPos, 1.0);}";
const fragShader = "uniform float animate;uniform float opacity;void main() {gl_FragColor = vec4(vec3(1.0), opacity);}";

function LogoExploder(svg, canvas) {

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        devicePixelRatio: window.devicePixelRatio
    });

    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(0, 0, 2);

    createApp(canvas, renderer, camera, scene);
    renderSVG(svg, scene);
}

module.exports = LogoExploder;
window["LogoExploder"] = LogoExploder;

function renderSVG(svg, scene) {

    const svgPath = getSvgPaths(svg);

    let complex = svgMesh3d(svgPath, {
        scale: 10,
        simplify: 1.0,
        // play with this value for different aesthetic
        // randomization: 1000,
    });

    complex = reindex(unindex(complex.positions, complex.cells));
    const attributes = getAnimationAttributes(complex.positions, complex.cells);
    const geometry = new createGeom(complex);

    const material = new THREE.ShaderMaterial({
        color: 0xC42026,
        side: THREE.DoubleSide,
        vertexShader: vertShader,
        fragmentShader: fragShader,
        transparent: true,
        attributes: attributes,
        uniforms: {
            opacity: {
                type: "f",
                value: 1,
            },
            scale: {
                type: "f",
                value: 0,
            },
            animate: {
                type: "f",
                value: 0,
            }
        }
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    tweenIt(material);
}

function tweenIt(material) {
    const interval = 4;
    // explode in
    tweenr.to(material.uniforms.animate, {
        value: 1,
        duration: 3.0,
        delay: 0,
        ease: "expoInOut",
    });
    tweenr.to(material.uniforms.scale, {
        value: 1,
        duration: 2,
        delay: 0,
    });

    // explode out
    tweenr.to(material.uniforms.scale, {
        delay: interval,
        value: 0,
        duration: 2.5,
        ease: "expoIn",
    });
    tweenr.to(material.uniforms.animate, {
        duration: 2.5,
        value: 0,
        delay: interval,
    }).on("complete", () => {
        tweenIt(material);
    });
}

function getAnimationAttributes(positions, cells) {
    const directions = [];
    const centroids = [];
    for (let i = 0; i < cells.length; i++) {
        const [f0, f1, f2] = cells[i];
        const triangle = [positions[f0], positions[f1], positions[f2]];
        const center = triangleCentroid(triangle);
        const dir = new THREE.Vector3().fromArray(center);
        centroids.push(dir, dir, dir);

        const random = randomVec3([], Math.random());
        const anim = new THREE.Vector3().fromArray(random);
        directions.push(anim, anim, anim);
    }
    return {
        direction: {type: "v3", value: directions},
        centroid: {type: "v3", value: centroids},
    }
}

function createApp(canvas, renderer, camera, scene) {

    // the application loop
    const app = createLoop(canvas, {scale: renderer.devicePixelRatio})
        .start()
        .on("tick", render)
        .on("resize", resize);

    function resize() {
        const [width, height] = app.shape;
        camera.aspect = width / height;
        renderer.setSize(width, height, false);
        camera.updateProjectionMatrix();
        render()
    }

    function render() {
        renderer.render(scene, camera);
    }

    resize();
}
