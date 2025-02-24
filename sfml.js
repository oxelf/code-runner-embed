const windowElement = document.getElementById("draggable");
const titleBar = document.getElementById("title-bar");
let isDragging = false;
let offsetX, offsetY;
let term = null;
let code = localStorage.getItem("sfml-code");
let running = false;
let scale = 1.0;
let windowWidth = 800;
let windowHeight = 600;
let initialWidth = 800;
let initialHeight = 600;

async function fetchTemplate(templateName) {
    let resp = await fetch(`./templates/${templateName}.cpp`);;
    return await resp.text();
}

titleBar.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - windowElement.offsetLeft;
    offsetY = e.clientY - windowElement.offsetTop;
});

document.addEventListener("mousemove", (e) => {
    if (isDragging) {
        windowElement.style.left = `${e.clientX - offsetX}px`;
        windowElement.style.top = `${e.clientY - offsetY}px`;
    }
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});

document.getElementById("close-btn").addEventListener("click", () => {
    windowElement.style.display = "none";
    stopCode();
});

function updateScale(newScale) {
    if (newScale <= 0.2) {
        return;
    }
    scale = newScale;
    windowWidth = initialWidth * scale;
    windowHeight = initialHeight * scale;
    emulator.screen_adapter.set_size_graphical(initialWidth, initialHeight);
    emulator.screen_adapter.set_scale(scale, scale);
    document.getElementById("draggable").style.width = `${windowWidth + 20}px`;
}

document.getElementById("scale-up-btn").addEventListener("click", () => {
    updateScale(scale + 0.1);
});
document.getElementById("scale-down-btn").addEventListener("click", () => {
    updateScale(scale - 0.1);
});

async function waitForPrompt(waitFor) {
    let output = "";
    await new Promise((resolve) => {
        emulator.add_listener("serial0-output-byte", function listener(byte) {
            let char = String.fromCharCode(byte);
            output += char;

            if (output.includes(waitFor)) {
                emulator.remove_listener("serial0-output-byte", listener);
                resolve(output);
            }
        });
    });
    return output;
}

async function writeCode(fileName, newCode) {
    let buffer = new TextEncoder().encode(newCode);
    // await emulator.serial0_send("rm /root/main.cpp && touch /root/main.cpp\n");
    // await waitForPrompt("(none):~# ");
    await emulator.create_file(fileName, buffer);
    await emulator.serial0_send("clear\n");
    await new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1000);
    });
}


async function stopCode() {
    running = false;
    await emulator.serial0_send("\x03");
    document.getElementById("run-btn").innerText = "Run";
    document.getElementById("run-btn").className = "px-4 py-1 bg-green-600 hover:bg-green-500 rounded text-sm";
    document.getElementById("draggable").style.display = "none";
}

window.addEventListener("resize", async function() {
    emulator.sc
});

async function runCode() {
    updateScale(scale);
    let fileName = "/root/" + crypto.randomUUID() + ".cpp";
    await writeCode(fileName, code);
    running = true;
    document.getElementById("run-btn").innerText = "Stop";
    document.getElementById("run-btn").className = "px-4 py-1 bg-red-600 hover:bg-red-500 rounded text-sm";
    await emulator.serial0_send("g++ -o /root/main " + fileName + " -lsfml-graphics -lsfml-window -lsfml-system\n");
    let res = await waitForPrompt("(none):~# ");
    if (res.includes("error")) {
        running = false;
        return;
    }
    //pci id for fd 10: 1234:1111, driver (null)
    await emulator.serial0_send("xinit  /root/main -geometry 1080x720+0+0 -- :0\n");
    await waitForPrompt("Setting vertical sync not supported");
    document.getElementById("draggable").style.display = "block";
}


new Promise(() => {
    setTimeout(() => {
        document.getElementById("run-btn").addEventListener("click", async () => {
            if (running) {
                await stopCode();
            } else {
                await runCode();
            }
        });
    }, 1000);
});



let emulator = null;

emulator = new V86({
    wasm_path: "./build/v86.wasm",
    memory_size: 256 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    screen_container: document.getElementById("screen_container"),
    bios: { url: "./bios/seabios.bin" },
    vga_bios: { url: "./bios/vgabios.bin" },
    filesystem: {
        baseurl: "./images/sfml-rootfs-flat",
        basefs: "./images/sfml-fs.json",
    },
    vga: {
        width: 480,
        height: 360,
        color_depth: 8
    },

    net_device: {
        type: "virtio",
        relay_url: "fetch",
        cors_proxy: ""
    },
    initial_state: { url: "./images/sfml-state.bin" },
    autostart: true,
    bzimage_initrd_from_filesystem: true,
    cmdline: "rw root=host9p rootfstype=9p, vga=773, rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable",
    preserve_mac_from_state_image: true,
    mac_address_translation: true,
});
emulator.add_listener("net0-send", function(packet) {
    console.log("net0-send", packet);
});
emulator.add_listener("emulator-ready", async function() {
    term = new Terminal();
    term.onData(data => emulator.serial0_send(data));
    term.open(document.getElementById('terminal'));
    emulator.add_listener("serial0-output-byte", function(byte) {
        let char = String.fromCharCode(byte);
        term.write(char);
    });
    await emulator.serial0_send("touch /root/main.cpp\n");
    term.write("clear\n\n");
    if (code === null) {
        code = await fetchTemplate("sfml-hello-world");
    }
    new Promise(() => {
        setTimeout(() => {
            document.querySelector("wc-monaco-editor").editor.setValue(code);
            document.querySelector("wc-monaco-editor").editor.getModel().onDidChangeContent((event) => {
                code = document.querySelector("wc-monaco-editor").editor.getValue();
                localStorage.setItem("sfml-code", code);
            });
        }, 1000);
    });


    //g++ -o main main.cpp -lsfml-graphics -lsfml-window -lsfml-system
    //xinit ./main -- :0
    await emulator.serial0_send("clear\n");
});

emulator.add_listener("net0-send", function(packet) {
    console.log("net0-send", packet);
});

