const body = document.body;
const lampPullCord = document.getElementById("lampPullCord");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const eyeIcon = document.getElementById("eyeIcon");
const loginForm = document.getElementById("loginForm");
const loginErrorMsg = document.getElementById("loginErrorMsg");
const btnLogin = document.getElementById("btnLogin");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const cordHint = document.getElementById("cordHint");
const lampVisual = document.getElementById("lampVisual");

let isLampOn = false;
let isDragging = false;
let dragStartY = 0;
let currentPull = 0;

// Gentle synthetic switch click sound
function playSwitchSound(isOn) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = isOn ? "sine" : "triangle";
        osc.frequency.setValueAtTime(isOn ? 850 : 420, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isOn ? 1250 : 220, ctx.currentTime + 0.07);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.07);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
        // AudioContext not allowed before user gesture or unavailable
    }
}

function setLampState(on, playAudio = true) {
    isLampOn = on;
    if (isLampOn) {
        body.classList.remove("lamp-off");
        body.classList.add("lamp-on");
        if (cordHint) {
            cordHint.innerHTML = "<span>💡 लैम्प बंद करने के लिए डोरी खींचें (Pull string to turn OFF)</span>";
        }
    } else {
        body.classList.add("lamp-off");
        body.classList.remove("lamp-on");
        if (cordHint) {
            cordHint.innerHTML = "<span>💡 लॉगिन करने के लिए डोरी खींचें (Pull string to turn ON)</span>";
        }
    }
    if (playAudio) {
        playSwitchSound(isLampOn);
    }
}

function triggerPullAnimation() {
    if (!lampPullCord) return;
    lampPullCord.classList.add("pulling");
    setTimeout(() => {
        lampPullCord.classList.remove("pulling");
    }, 220);
}

function toggleLamp() {
    triggerPullAnimation();
    setLampState(!isLampOn, true);
}

// Click and Keyboard on Pull Cord
if (lampPullCord) {
    lampPullCord.addEventListener("click", (e) => {
        e.preventDefault();
        toggleLamp();
    });

    lampPullCord.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleLamp();
        }
    });

    // Touch & Pointer Drag mechanics for pull cord
    lampPullCord.addEventListener("pointerdown", (e) => {
        isDragging = true;
        dragStartY = e.clientY;
        lampPullCord.setPointerCapture?.(e.pointerId);
    });

    window.addEventListener("pointermove", (e) => {
        if (!isDragging || !lampPullCord) return;
        const delta = e.clientY - dragStartY;
        if (delta > 0) {
            currentPull = Math.min(delta, 35);
            lampPullCord.style.transform = `translateY(${currentPull}px)`;
        }
    });

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        if (lampPullCord) {
            lampPullCord.style.transform = "";
        }
        if (currentPull > 12) {
            toggleLamp();
        }
        currentPull = 0;
    };

    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
}

if (cordHint) {
    cordHint.style.cursor = "pointer";
    cordHint.addEventListener("click", () => {
        toggleLamp();
    });
}

// Interactive cute reaction when typing password
if (passwordInput) {
    passwordInput.addEventListener("focus", () => {
        body.classList.add("shy-mode");
    });

    passwordInput.addEventListener("blur", () => {
        body.classList.remove("shy-mode");
    });
}

// Toggle Show/Hide Password
if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        togglePasswordBtn.style.color = isPassword ? "#00e676" : "#5c749e";
        if (eyeIcon) {
            eyeIcon.innerHTML = isPassword
                ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
                : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
        }
    });
}

// Error presentation
function showError(msg) {
    if (!loginErrorMsg) return;
    loginErrorMsg.textContent = msg;
    loginErrorMsg.classList.add("visible");
}

function hideError() {
    if (!loginErrorMsg) return;
    loginErrorMsg.textContent = "";
    loginErrorMsg.classList.remove("visible");
}

if (usernameInput) usernameInput.addEventListener("input", hideError);
if (passwordInput) passwordInput.addEventListener("input", hideError);

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        showError("कृपया अपना पासवर्ड रीसेट कराने के लिए व्यवस्थापक (Admin) से संपर्क करें।");
    });
}

// Login Form Submission
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError();

        const username = usernameInput ? usernameInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value.trim() : "";

        if (!username || !password) {
            showError("Username and password are required.");
            return;
        }

        if (btnLogin) {
            btnLogin.classList.add("loading");
            btnLogin.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
                </svg>
                <span>Logging in...</span>
            `;
        }

        try {
            const baseUrl = window.API_BASE_URL || (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "https://paribilling-api.onrender.com");
            const response = await fetch(`${baseUrl}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            let result = null;
            try {
                result = await response.json();
            } catch (jsonErr) {
                // Non-JSON response
            }

            if (result && result.success === true && result.token) {
                const userRole = (result.user && result.user.role ? String(result.user.role).trim().toLowerCase() : "");
                if (userRole === "technician") {
                    showError("Technicians billing software par login nahi kar sakte. Kripya Android Mobile App par login karein.");
                    return;
                }
                localStorage.setItem("pari_auth_token", result.token);
                localStorage.setItem("pari_current_user", JSON.stringify(result.user || {}));
                window.location.href = "dashboard.html";
                return;
            }

            if (result && result.message) {
                showError(result.message);
            } else if (response.status === 429) {
                showError("बहुत ज्यादा गलत प्रयास। कृपया कुछ क्षण बाद पुनः प्रयास करें।");
            } else if (response.status === 401 || response.status === 400) {
                showError("गलत यूजरनेम या पासवर्ड।");
            } else {
                showError("Invalid username or password.");
            }
        } catch (error) {
            console.error("Login Error:", error);
            showError("सर्वर से कनेक्ट नहीं हो पा रहा है। कृपया सुनिश्चित करें कि बैकएंड (127.0.0.1:5000) चालू है।");
        } finally {
            if (btnLogin) {
                btnLogin.classList.remove("loading");
                btnLogin.innerHTML = "<span>Login</span>";
            }
        }
    });
}

// Initial state: Lamp is OFF by default, login panel hidden until lamp is lit
setLampState(false, false);
