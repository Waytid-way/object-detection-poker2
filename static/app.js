const elements = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    uploadPrompt: document.getElementById("uploadPrompt"),
    mediaWrapper: document.getElementById("mediaWrapper"),
    displayImage: document.getElementById("displayImage"),
    displayVideo: document.getElementById("displayVideo"),
    hiddenCanvas: document.getElementById("hiddenCanvas"),
    scannerOverlay: document.getElementById("scannerOverlay"),
    confSlider: document.getElementById("confSlider"),
    confValueDisplay: document.getElementById("confValueDisplay"),
    toggleBoxes: document.getElementById("toggleBoxes"),
    webcamBtn: document.getElementById("webcamBtn"),
    clearBtn: document.getElementById("clearBtn"),
    emptyAnalysis: document.getElementById("emptyAnalysis"),
    emptyAnalysisTitle: document.getElementById("emptyAnalysisTitle"),
    emptyAnalysisCopy: document.getElementById("emptyAnalysisCopy"),
    resultAnalysis: document.getElementById("resultAnalysis"),
    visualCardsContainer: document.getElementById("visualCardsContainer"),
    bestHandResult: document.getElementById("bestHandResult"),
    bestHandCards: document.getElementById("bestHandCards"),
    drawsContainer: document.getElementById("drawsContainer"),
    drawsResult: document.getElementById("drawsResult"),
    cardCount: document.getElementById("cardCount"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText")
};

const ctx = elements.hiddenCanvas.getContext("2d");

const state = {
    currentDetections: [],
    activeMode: "idle",
    detectionLoopTimeout: null,
    stream: null,
    currentObjectUrl: null,
    requestVersion: 0,
    isProcessing: false
};

const suitEntityMap = {
    S: "&spades;",
    H: "&hearts;",
    D: "&diams;",
    C: "&clubs;"
};

initialize();

function initialize() {
    elements.confValueDisplay.textContent = elements.confSlider.value + "%";

    elements.dropzone.addEventListener("click", (event) => {
        if (event.target.closest("#mediaWrapper")) {
            return;
        }
        elements.fileInput.click();
    });

    elements.dropzone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            elements.fileInput.click();
        }
    });

    elements.fileInput.addEventListener("change", (event) => {
        const [file] = event.target.files || [];
        if (file) {
            handleFile(file);
        }
    });

    elements.dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        elements.dropzone.classList.add("dragover");
    });

    ["dragleave", "dragend"].forEach((eventName) => {
        elements.dropzone.addEventListener(eventName, () => {
            elements.dropzone.classList.remove("dragover");
        });
    });

    elements.dropzone.addEventListener("drop", (event) => {
        event.preventDefault();
        elements.dropzone.classList.remove("dragover");

        const [file] = event.dataTransfer.files || [];
        if (file) {
            handleFile(file);
        }
    });

    elements.confSlider.addEventListener("input", () => {
        elements.confValueDisplay.textContent = elements.confSlider.value + "%";
        renderDetections();
    });

    elements.toggleBoxes.addEventListener("change", updateBoundingBoxVisibility);
    elements.webcamBtn.addEventListener("click", toggleWebcam);
    elements.clearBtn.addEventListener("click", resetUI);

    elements.displayVideo.addEventListener("play", () => {
        if (state.activeMode === "video") {
            queueNextDetection(160);
        }
    });

    elements.displayVideo.addEventListener("pause", () => {
        if (state.activeMode === "video") {
            clearDetectionLoop();
            setStatus("success", "วิดีโอถูกหยุดชั่วคราว");
        }
    });

    elements.displayVideo.addEventListener("ended", () => {
        if (state.activeMode === "video") {
            clearDetectionLoop();
            setStatus("success", "วิดีโอจบแล้ว");
        }
    });

    resetUI();
}

async function handleFile(file) {
    prepareForNewSession(file.type.startsWith("video/") ? "video" : "image");
    showMediaStage();
    setObjectUrl(file);

    if (file.type.startsWith("video/")) {
        elements.displayImage.classList.add("hidden");
        elements.displayVideo.classList.remove("hidden");
        elements.displayVideo.controls = true;
        elements.displayVideo.srcObject = null;
        elements.displayVideo.src = state.currentObjectUrl;
        elements.displayVideo.load();

        elements.displayVideo.onloadedmetadata = async () => {
            if (state.activeMode !== "video") {
                return;
            }

            syncCanvasSize();
            try {
                await elements.displayVideo.play();
            } catch (error) {
                setStatus("error", "เบราว์เซอร์ไม่ยอมเล่นวิดีโออัตโนมัติ");
                return;
            }

            setStatus("live", "วิเคราะห์วิดีโอแบบต่อเนื่อง");
            queueNextDetection(100);
        };

        return;
    }

    elements.displayVideo.pause();
    elements.displayVideo.removeAttribute("src");
    elements.displayVideo.load();
    elements.displayVideo.classList.add("hidden");
    elements.displayImage.classList.remove("hidden");
    elements.displayImage.src = state.currentObjectUrl;
    elements.displayImage.onload = async () => {
        if (state.activeMode !== "image") {
            return;
        }

        await detectStillImage(file);
    };
}

async function detectStillImage(file) {
    const detections = await requestDetection(file, {
        showOverlay: true,
        idleText: "กำลังวิเคราะห์ภาพ"
    });

    if (detections) {
        setStatus("success", detections.length ? "สแกนภาพสำเร็จ" : "ไม่พบไพ่ในภาพ");
        renderDetections();
    }
}

async function toggleWebcam() {
    if (state.activeMode === "webcam") {
        resetUI();
        return;
    }

    prepareForNewSession("webcam");
    showMediaStage();
    elements.displayImage.classList.add("hidden");
    elements.displayVideo.classList.remove("hidden");
    elements.displayVideo.controls = false;

    try {
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 960 },
                height: { ideal: 540 },
                facingMode: "environment"
            },
            audio: false
        });
    } catch (error) {
        setStatus("error", "ไม่สามารถเปิดกล้องได้");
        resetMediaStage();
        renderEmptyAnalysis("เปิดกล้องไม่สำเร็จ", "ตรวจสอบ permission ของ browser แล้วลองใหม่");
        return;
    }

    elements.displayVideo.src = "";
    elements.displayVideo.srcObject = state.stream;
    elements.displayVideo.onloadedmetadata = async () => {
        if (state.activeMode !== "webcam") {
            return;
        }

        syncCanvasSize();
        try {
            await elements.displayVideo.play();
        } catch (error) {
            stopStream();
            clearDetectionLoop();
            state.activeMode = "idle";
            resetMediaStage();
            updateWebcamButton(false);
            setStatus("error", "เบราว์เซอร์เริ่มกล้องไม่สำเร็จ");
            renderEmptyAnalysis("เริ่มกล้องไม่สำเร็จ", "ลองรีเฟรชหน้าแล้วอนุญาตให้เข้าถึงกล้องอีกครั้ง");
            return;
        }
        updateWebcamButton(true);
        setStatus("live", "กล้องทำงานแล้ว กำลังวิเคราะห์แบบต่อเนื่อง");
        queueNextDetection(80);
    };
}

async function processLiveFrame() {
    if (!isLiveModeActive() || state.isProcessing) {
        return;
    }

    if (elements.displayVideo.readyState < 2) {
        queueNextDetection(180);
        return;
    }

    syncCanvasSize();
    ctx.drawImage(elements.displayVideo, 0, 0, elements.hiddenCanvas.width, elements.hiddenCanvas.height);

    const blob = await canvasToBlob();
    if (!blob) {
        queueNextDetection(220);
        return;
    }

    const detections = await requestDetection(blob, {
        filename: `frame_${Date.now()}.jpg`,
        idleText: state.activeMode === "webcam" ? "วิเคราะห์กล้องแบบต่อเนื่อง" : "วิเคราะห์วิดีโอแบบต่อเนื่อง"
    });

    if (detections && isLiveModeActive()) {
        setStatus("live", state.activeMode === "webcam" ? "กล้องกำลังตรวจจับไพ่" : "กำลังอ่านเฟรมจากวิดีโอ");
        renderDetections();
    }

    if (isLiveModeActive()) {
        queueNextDetection(state.activeMode === "webcam" ? 250 : 420);
    }
}

async function requestDetection(fileOrBlob, options = {}) {
    const version = state.requestVersion;
    const formData = new FormData();
    const filename = options.filename || (fileOrBlob instanceof File ? fileOrBlob.name : "capture.jpg");

    formData.append("image", fileOrBlob, filename);
    formData.append("confidence", elements.confSlider.value);

    state.isProcessing = true;
    if (options.showOverlay) {
        elements.scannerOverlay.classList.remove("hidden");
    }
    setStatus("analyzing", options.idleText || "กำลังประมวลผล");

    try {
        const response = await fetch("/detect", {
            method: "POST",
            body: formData
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Detection request failed");
        }

        if (version !== state.requestVersion) {
            return null;
        }

        state.currentDetections = payload.detections || [];
        return state.currentDetections;
    } catch (error) {
        if (version === state.requestVersion) {
            state.currentDetections = [];
            renderEmptyAnalysis("เชื่อมต่อ /detect ไม่สำเร็จ", error.message || "Backend ตอบกลับผิดพลาด");
            setStatus("error", "เชื่อมต่อ backend ไม่สำเร็จ");
        }
        return null;
    } finally {
        state.isProcessing = false;
        if (options.showOverlay) {
            elements.scannerOverlay.classList.add("hidden");
        }
    }
}

function renderDetections() {
    clearBoundingBoxes();
    elements.visualCardsContainer.innerHTML = "";

    const threshold = Number(elements.confSlider.value);
    const visibleDetections = state.currentDetections.filter((detection) => detection.confidence >= threshold);

    if (!visibleDetections.length) {
        elements.resultAnalysis.classList.add("hidden");
        elements.emptyAnalysis.classList.remove("hidden");
        renderEmptyAnalysis("ไม่พบไพ่ที่ผ่าน threshold", "ลองลดค่า confidence หรือเปลี่ยนมุมกล้องแล้วสแกนใหม่");
        elements.cardCount.textContent = "0";
        elements.bestHandResult.textContent = "";
        elements.bestHandCards.textContent = "";
        elements.drawsContainer.classList.add("hidden");
        return;
    }

    visibleDetections.forEach((detection, index) => {
        elements.mediaWrapper.appendChild(createBoundingBox(detection));
        elements.visualCardsContainer.insertAdjacentHTML("beforeend", createCardHTML(detection.class, index * 40));
    });

    const detectedClasses = visibleDetections.map((detection) => detection.class);
    const evaluation = evaluateTexasHoldem(detectedClasses);

    elements.emptyAnalysis.classList.add("hidden");
    elements.resultAnalysis.classList.remove("hidden");
    elements.cardCount.textContent = String(detectedClasses.length);

    if (evaluation && evaluation.bestHand) {
        elements.bestHandResult.innerHTML = `<span>${evaluation.bestHand.name}</span>`;
        elements.bestHandCards.innerHTML = evaluation.bestHand.cards.map(createCardTextHTML).join("");

        if (evaluation.draws.length) {
            elements.drawsContainer.classList.remove("hidden");
            elements.drawsResult.textContent = evaluation.draws.join(" / ");
        } else {
            elements.drawsContainer.classList.add("hidden");
        }
    }

    updateBoundingBoxVisibility();
}

function createBoundingBox(detection) {
    const box = document.createElement("div");
    box.className = "bounding-box";
    box.style.left = `${detection.box.left}%`;
    box.style.top = `${detection.box.top}%`;
    box.style.width = `${detection.box.width}%`;
    box.style.height = `${detection.box.height}%`;

    const label = document.createElement("span");
    label.className = "box-label";
    label.textContent = `${detection.class} (${Math.round(detection.confidence)}%)`;

    box.appendChild(label);
    return box;
}

function createCardHTML(className, animationDelay) {
    const rank = className.slice(0, -1);
    const suit = className.slice(-1);
    const colorClass = isRedSuit(suit) ? "card-red" : "card-black";
    const suitEntity = suitEntityMap[suit] || suit;

    return `
        <div class="playing-card ${colorClass}" style="animation-delay:${animationDelay}ms">
            <div>
                <div class="card-rank">${rank}</div>
                <div class="card-suit">${suitEntity}</div>
            </div>
            <div class="card-center">${suitEntity}</div>
            <div class="card-bottom">
                <div class="card-rank">${rank}</div>
                <div class="card-suit">${suitEntity}</div>
            </div>
        </div>
    `;
}

function createCardTextHTML(className) {
    const rank = className.slice(0, -1);
    const suit = className.slice(-1);
    const colorClass = isRedSuit(suit) ? "card-text is-red" : "card-text";
    const suitEntity = suitEntityMap[suit] || suit;
    return `<span class="${colorClass}">${rank}${suitEntity}</span>`;
}

function evaluateTexasHoldem(classes) {
    if (!classes.length) {
        return null;
    }

    const rankValues = {
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
        J: 11,
        Q: 12,
        K: 13,
        A: 14
    };

    const uniqueCards = new Map();
    classes.forEach((className) => {
        const rank = className.slice(0, -1);
        const suit = className.slice(-1);
        if (!uniqueCards.has(className)) {
            uniqueCards.set(className, {
                code: className,
                rank,
                suit,
                value: rankValues[rank]
            });
        }
    });

    const cards = Array.from(uniqueCards.values()).sort((left, right) => right.value - left.value);
    const rankCounts = {};
    const suitCounts = {};

    cards.forEach((card) => {
        rankCounts[card.value] = (rankCounts[card.value] || 0) + 1;
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    let flushCards = [];
    Object.entries(suitCounts).forEach(([suit, count]) => {
        if (count >= 5 && !flushCards.length) {
            flushCards = cards.filter((card) => card.suit === suit);
        }
    });

    function findStraight(cardSet) {
        const uniqueValues = [...new Set(cardSet.map((card) => card.value))].sort((left, right) => right - left);
        if (uniqueValues.includes(14)) {
            uniqueValues.push(1);
        }

        for (let index = 0; index <= uniqueValues.length - 5; index += 1) {
            if (uniqueValues[index] - uniqueValues[index + 4] === 4) {
                return uniqueValues.slice(index, index + 5).map((value) => {
                    const actualValue = value === 1 ? 14 : value;
                    return cardSet.find((card) => card.value === actualValue).code;
                });
            }
        }

        return null;
    }

    function getDraws() {
        const draws = [];
        if (Object.values(suitCounts).some((count) => count === 4)) {
            draws.push("Flush Draw");
        }

        const uniqueValues = [...new Set(cards.map((card) => card.value))].sort((left, right) => right - left);
        if (uniqueValues.includes(14)) {
            uniqueValues.push(1);
        }

        let hasOpenEnded = false;
        let hasGutshot = false;

        for (let index = 0; index <= uniqueValues.length - 4; index += 1) {
            const diff = uniqueValues[index] - uniqueValues[index + 3];
            if (diff === 3) {
                const top = uniqueValues[index];
                if (top === 14 || top === 4) {
                    hasGutshot = true;
                } else {
                    hasOpenEnded = true;
                }
            } else if (diff === 4) {
                hasGutshot = true;
            }
        }

        if (hasOpenEnded) {
            draws.push("Open-Ended Straight Draw");
        } else if (hasGutshot) {
            draws.push("Gutshot Straight Draw");
        }

        return draws;
    }

    function getGroupedRanks() {
        const grouped = { 4: [], 3: [], 2: [], 1: [] };
        Object.entries(rankCounts).forEach(([value, count]) => {
            grouped[count].push(Number(value));
        });
        Object.values(grouped).forEach((group) => group.sort((left, right) => right - left));
        return grouped;
    }

    function getCardsByValues(values) {
        return cards
            .filter((card) => values.includes(card.value))
            .slice(0, 5)
            .map((card) => card.code);
    }

    function getBestHand() {
        if (flushCards.length >= 5) {
            const straightFlushCards = findStraight(flushCards);
            if (straightFlushCards) {
                const royalPattern = ["A", "K", "Q", "J", "10"];
                const ranks = straightFlushCards.map((card) => card.slice(0, -1));
                if (royalPattern.every((rank, index) => rank === ranks[index])) {
                    return { name: "Royal Flush", cards: straightFlushCards };
                }
                return { name: "Straight Flush", cards: straightFlushCards };
            }
        }

        const grouped = getGroupedRanks();

        if (grouped[4].length) {
            return {
                name: "Four of a Kind",
                cards: getCardsByValues([grouped[4][0]])
            };
        }

        if (grouped[3].length && (grouped[3].length > 1 || grouped[2].length)) {
            const pairValue = grouped[3].length > 1 ? grouped[3][1] : grouped[2][0];
            return {
                name: "Full House",
                cards: getCardsByValues([grouped[3][0], pairValue])
            };
        }

        if (flushCards.length >= 5) {
            return {
                name: "Flush",
                cards: flushCards.slice(0, 5).map((card) => card.code)
            };
        }

        const straightCards = findStraight(cards);
        if (straightCards) {
            return { name: "Straight", cards: straightCards };
        }

        if (grouped[3].length) {
            return {
                name: "Three of a Kind",
                cards: getCardsByValues([grouped[3][0]])
            };
        }

        if (grouped[2].length >= 2) {
            return {
                name: "Two Pair",
                cards: getCardsByValues([grouped[2][0], grouped[2][1]])
            };
        }

        if (grouped[2].length === 1) {
            return {
                name: "Pair",
                cards: getCardsByValues([grouped[2][0]])
            };
        }

        return {
            name: "High Card",
            cards: [cards[0].code]
        };
    }

    return {
        bestHand: getBestHand(),
        draws: getDraws()
    };
}

function setStatus(type, message) {
    elements.statusText.textContent = message;
    elements.statusDot.className = "status-dot";
    elements.statusDot.classList.add(`is-${type}`);
}

function renderEmptyAnalysis(title, message) {
    elements.emptyAnalysisTitle.textContent = title;
    elements.emptyAnalysisCopy.textContent = message;
}

function prepareForNewSession(mode) {
    state.requestVersion += 1;
    state.activeMode = mode;
    state.currentDetections = [];
    state.isProcessing = false;

    clearDetectionLoop();
    stopStream();
    clearBoundingBoxes();
    clearAnalysis();
    revokeObjectUrl();

    elements.fileInput.value = "";
    elements.scannerOverlay.classList.add("hidden");
    updateWebcamButton(false);
}

function resetUI() {
    prepareForNewSession("idle");
    resetMediaStage();
    renderEmptyAnalysis("พร้อมสแกนไพ่", "อัปโหลดรูป เปิดกล้อง หรือใช้วิดีโอเพื่อเริ่มวิเคราะห์บน frontend จริง");
    setStatus("idle", "พร้อมใช้งาน");
}

function resetMediaStage() {
    elements.mediaWrapper.classList.add("hidden");
    elements.uploadPrompt.classList.remove("hidden");
    elements.displayImage.classList.add("hidden");
    elements.displayImage.removeAttribute("src");
    elements.displayImage.onload = null;

    elements.displayVideo.pause();
    elements.displayVideo.onloadedmetadata = null;
    elements.displayVideo.removeAttribute("src");
    elements.displayVideo.srcObject = null;
    elements.displayVideo.classList.add("hidden");
    elements.displayVideo.controls = false;
    elements.displayVideo.load();
}

function showMediaStage() {
    elements.uploadPrompt.classList.add("hidden");
    elements.mediaWrapper.classList.remove("hidden");
}

function clearAnalysis() {
    elements.visualCardsContainer.innerHTML = "";
    elements.bestHandResult.textContent = "";
    elements.bestHandCards.textContent = "";
    elements.cardCount.textContent = "0";
    elements.drawsContainer.classList.add("hidden");
    elements.drawsResult.textContent = "";
    elements.resultAnalysis.classList.add("hidden");
    elements.emptyAnalysis.classList.remove("hidden");
}

function clearBoundingBoxes() {
    document.querySelectorAll(".bounding-box").forEach((node) => node.remove());
}

function updateBoundingBoxVisibility() {
    document.querySelectorAll(".bounding-box").forEach((node) => {
        node.style.opacity = elements.toggleBoxes.checked ? "1" : "0";
    });
}

function updateWebcamButton(isActive) {
    elements.webcamBtn.classList.toggle("is-active", isActive);
    elements.webcamBtn.querySelector("span").textContent = isActive ? "ปิดกล้อง" : "เปิดกล้อง";
}

function clearDetectionLoop() {
    if (state.detectionLoopTimeout) {
        clearTimeout(state.detectionLoopTimeout);
        state.detectionLoopTimeout = null;
    }
}

function queueNextDetection(delay) {
    clearDetectionLoop();
    state.detectionLoopTimeout = setTimeout(() => {
        processLiveFrame();
    }, delay);
}

function stopStream() {
    if (!state.stream) {
        return;
    }

    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
}

function revokeObjectUrl() {
    if (!state.currentObjectUrl) {
        return;
    }

    URL.revokeObjectURL(state.currentObjectUrl);
    state.currentObjectUrl = null;
}

function setObjectUrl(file) {
    revokeObjectUrl();
    state.currentObjectUrl = URL.createObjectURL(file);
}

function syncCanvasSize() {
    const width = elements.displayVideo.videoWidth || elements.displayImage.naturalWidth || 0;
    const height = elements.displayVideo.videoHeight || elements.displayImage.naturalHeight || 0;

    if (width && height) {
        elements.hiddenCanvas.width = width;
        elements.hiddenCanvas.height = height;
    }
}

function canvasToBlob() {
    return new Promise((resolve) => {
        elements.hiddenCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.88);
    });
}

function isLiveModeActive() {
    return state.activeMode === "video" || state.activeMode === "webcam";
}

function isRedSuit(suit) {
    return suit === "H" || suit === "D";
}
