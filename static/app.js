const elements = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    uploadPrompt: document.getElementById("uploadPrompt"),
    mediaWrapper: document.getElementById("mediaWrapper"),
    mediaStage: document.getElementById("mediaStage"),
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
    tipsContainer: document.getElementById("tipsContainer"),
    tipsTitle: document.getElementById("tipsTitle"),
    tipsBody: document.getElementById("tipsBody"),
    closeTipsBtn: document.getElementById("closeTipsBtn"),
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
    isProcessing: false,
    stableDetections: [],
    pendingStableDetections: [],
    pendingStableSignature: "",
    pendingStableCount: 0,
    missingStableCount: 0,
    lastRenderedCardsSignature: "",
    lastRenderedAnalysisSignature: ""
};

const suitEntityMap = {
    S: "&spades;",
    H: "&hearts;",
    D: "&diams;",
    C: "&clubs;"
};

const WEBCAM_DETECTION_DELAY_MS = 120;
const VIDEO_DETECTION_DELAY_MS = 200;
const STABLE_DETECTION_FRAMES = 2;
const STABLE_MISSING_FRAMES_TO_CLEAR = 3;

const HAND_TIPS = {
    "Royal Flush": {
        title: "Royal Flush",
        body: "ไพ่สเตรทฟลัชสูงสุด 5 ใบคือ A-K-Q-J-10 ดอกเดียวกัน เป็นไพ่ที่ชนะสูงสุดในโป๊กเกอร์และไม่มี hand ไหนชนะได้"
    },
    "Straight Flush": {
        title: "Straight Flush",
        body: "ไพ่เรียงกัน 5 ใบและเป็นดอกเดียวกัน เช่น 5-6-7-8-9 โพดำ เป็น hand ที่แข็งมาก รองจาก Royal Flush เท่านั้น"
    },
    "Four of a Kind": {
        title: "Four of a Kind",
        body: "มีไพ่ rank เดียวกัน 4 ใบ เช่น J 4 ใบ เรียกสั้น ๆ ว่า quads โดยทั่วไปชนะ hand ส่วนใหญ่แบบขาด"
    },
    "Full House": {
        title: "Full House",
        body: "ประกอบจากตอง 1 ชุดและคู่ 1 ชุด เช่น 8-8-8 กับ K-K เป็น hand ที่นิ่งและแข็งมากเมื่อ board มีการจับคู่"
    },
    "Flush": {
        title: "Flush",
        body: "มีไพ่ดอกเดียวกันอย่างน้อย 5 ใบ ไม่จำเป็นต้องเรียงกัน เช่น หัวใจ 5 ใบ ถ้ามีหลายคนติด flush จะตัดสินจากไพ่สูงสุดใน flush"
    },
    "Straight": {
        title: "Straight",
        body: "มีไพ่เรียงกัน 5 ใบ ไม่จำเป็นต้องดอกเดียวกัน เช่น 4-5-6-7-8 จุดสำคัญคือดูไพ่ปลายสูงสุดของลำดับนั้น"
    },
    "Three of a Kind": {
        title: "Three of a Kind",
        body: "มีไพ่ rank เดียวกัน 3 ใบ เช่น Q-Q-Q เรียกว่า set หรือ trips แล้วแต่ที่มาของไพ่ เป็น hand กลางถึงแข็ง"
    },
    "Two Pair": {
        title: "Two Pair",
        body: "มีคู่ 2 ชุด เช่น A-A และ 10-10 โดยจะตัดสินกันที่คู่สูงก่อน แล้วค่อยดูคู่รองและ kicker"
    },
    "Pair": {
        title: "Pair",
        body: "มีไพ่ rank เดียวกัน 2 ใบ เป็น hand พื้นฐานที่เจอบ่อยมาก การชนะหรือแพ้จะขึ้นกับขนาดคู่และ kicker ที่ตามมา"
    },
    "High Card": {
        title: "High Card",
        body: "ยังไม่ติดคู่ ไม่ติด straight และไม่ติด flush จึงใช้ไพ่สูงสุดเป็นตัวตัดสิน เช่น A-high หมายถึงไพ่สูงสุดคือ A"
    },
    "Flush Draw": {
        title: "Flush Draw",
        body: "ตอนนี้คุณมีไพ่ดอกเดียวกัน 4 ใบและต้องการอีก 1 ใบเพื่อให้ครบ flush ปกติคิดเป็นประมาณ 9 outs"
    },
    "Open-Ended Straight Draw": {
        title: "Open-Ended Straight Draw",
        body: "มีไพ่เรียงต่อกัน 4 ใบและรอได้ 2 ด้าน เช่น 6-7-8-9 ถ้าออก 5 หรือ 10 ก็จะครบ straight ปกติมีประมาณ 8 outs"
    },
    "Gutshot Straight Draw": {
        title: "Gutshot Straight Draw",
        body: "มีไพ่เกือบเรียง 4 ใบแต่ขาดตรงกลางแค่ 1 ค่า เช่น 6-7-9-10 ต้องการ 8 เท่านั้นถึงจะครบ straight ปกติมีประมาณ 4 outs"
    }
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
        if (isLiveModeActive()) {
            resetStabilityState();
        }
        renderDetections();
    });

    elements.toggleBoxes.addEventListener("change", updateBoundingBoxVisibility);
    elements.webcamBtn.addEventListener("click", toggleWebcam);
    elements.clearBtn.addEventListener("click", resetUI);
    elements.closeTipsBtn.addEventListener("click", hideTips);
    elements.resultAnalysis.addEventListener("click", handleTipsClick);

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
        queueNextDetection(state.activeMode === "webcam" ? WEBCAM_DETECTION_DELAY_MS : VIDEO_DETECTION_DELAY_MS);
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

    const threshold = Number(elements.confSlider.value);
    const visibleDetections = state.currentDetections.filter((detection) => detection.confidence >= threshold);

    visibleDetections.forEach((detection) => {
        elements.mediaStage.appendChild(createBoundingBox(detection));
    });

    if (isLiveModeActive()) {
        updateStableDetections(visibleDetections);
    } else {
        commitStableDetections(visibleDetections);
    }

    renderStableAnalysis(visibleDetections);
    updateBoundingBoxVisibility();
}

function renderStableAnalysis(visibleDetections) {
    const stableDetections = state.stableDetections;

    if (!stableDetections.length) {
        clearRenderedResults();

        if (isLiveModeActive() && visibleDetections.length) {
            renderEmptyAnalysis(
                "กำลังยืนยันไพ่...",
                `ต้องเห็นชุดไพ่เดิม ${STABLE_DETECTION_FRAMES} เฟรมติดกันก่อนอัปเดต panel`
            );
        } else {
            renderEmptyAnalysis("ไม่พบไพ่ที่ผ่าน threshold", "ลองลดค่า confidence หรือเปลี่ยนมุมกล้องแล้วสแกนใหม่");
        }
        return;
    }

    const detectedClasses = stableDetections.map((detection) => detection.class);
    const normalizedClasses = [...detectedClasses].sort();
    const cardsSignature = normalizedClasses.join("|");
    const evaluation = evaluateTexasHoldem(detectedClasses);
    const analysisSignature = JSON.stringify({
        classes: normalizedClasses,
        bestHandName: evaluation?.bestHand?.name || "",
        bestHandCards: evaluation?.bestHand?.cards ? [...evaluation.bestHand.cards].sort() : [],
        draws: evaluation?.draws ? [...evaluation.draws].sort() : []
    });

    elements.emptyAnalysis.classList.add("hidden");
    elements.resultAnalysis.classList.remove("hidden");
    elements.cardCount.textContent = String(detectedClasses.length);

    if (cardsSignature !== state.lastRenderedCardsSignature) {
        renderVisualCards(detectedClasses);
        state.lastRenderedCardsSignature = cardsSignature;
    }

    if (analysisSignature !== state.lastRenderedAnalysisSignature && evaluation && evaluation.bestHand) {
        hideTips();
        elements.bestHandResult.innerHTML = `
            <span>${evaluation.bestHand.name}</span>
            ${createTipTriggerHTML(evaluation.bestHand.name)}
        `;
        elements.bestHandCards.innerHTML = evaluation.bestHand.cards.map(createCardTextHTML).join("");

        if (evaluation.draws.length) {
            elements.drawsContainer.classList.remove("hidden");
            elements.drawsResult.innerHTML = evaluation.draws.map(createDrawChipHTML).join("");
        } else {
            elements.drawsContainer.classList.add("hidden");
            elements.drawsResult.innerHTML = "";
        }

        state.lastRenderedAnalysisSignature = analysisSignature;
    }
}

function renderVisualCards(detectedClasses) {
    elements.visualCardsContainer.innerHTML = "";
    detectedClasses.forEach((className, index) => {
        elements.visualCardsContainer.insertAdjacentHTML("beforeend", createCardHTML(className, index * 40));
    });
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

function createTipTriggerHTML(key) {
    return `<button class="tip-trigger" type="button" data-tip-key="${escapeHtmlAttribute(key)}" aria-label="ดูคำอธิบาย ${escapeHtmlAttribute(key)}">?</button>`;
}

function createDrawChipHTML(drawName) {
    return `
        <span class="draw-chip">
            <span>${drawName}</span>
            ${createTipTriggerHTML(drawName)}
        </span>
    `;
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
    resetStabilityState();
    clearRenderedResults();
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
    elements.drawsResult.innerHTML = "";
    elements.resultAnalysis.classList.add("hidden");
    elements.emptyAnalysis.classList.remove("hidden");
    hideTips();
}

function clearRenderedResults() {
    state.lastRenderedCardsSignature = "";
    state.lastRenderedAnalysisSignature = "";
    clearAnalysis();
}

function cloneDetections(detections) {
    return detections.map((detection) => ({
        ...detection,
        box: { ...detection.box }
    }));
}

function getDetectionsSignature(detections) {
    return detections
        .map((detection) => detection.class)
        .sort()
        .join("|");
}

function resetStabilityState() {
    state.stableDetections = [];
    state.pendingStableDetections = [];
    state.pendingStableSignature = "";
    state.pendingStableCount = 0;
    state.missingStableCount = 0;
}

function commitStableDetections(detections) {
    state.stableDetections = cloneDetections(detections);
    state.pendingStableDetections = [];
    state.pendingStableSignature = "";
    state.pendingStableCount = 0;
    state.missingStableCount = 0;
}

function updateStableDetections(visibleDetections) {
    const incomingSignature = getDetectionsSignature(visibleDetections);
    const stableSignature = getDetectionsSignature(state.stableDetections);

    if (!visibleDetections.length) {
        state.pendingStableDetections = [];
        state.pendingStableSignature = "";
        state.pendingStableCount = 0;

        if (state.stableDetections.length) {
            state.missingStableCount += 1;
            if (state.missingStableCount >= STABLE_MISSING_FRAMES_TO_CLEAR) {
                resetStabilityState();
            }
        }
        return;
    }

    state.missingStableCount = 0;

    if (incomingSignature === stableSignature) {
        state.pendingStableDetections = [];
        state.pendingStableSignature = "";
        state.pendingStableCount = 0;
        return;
    }

    if (incomingSignature !== state.pendingStableSignature) {
        state.pendingStableSignature = incomingSignature;
        state.pendingStableDetections = cloneDetections(visibleDetections);
        state.pendingStableCount = 1;
        return;
    }

    state.pendingStableCount += 1;
    if (state.pendingStableCount >= STABLE_DETECTION_FRAMES) {
        state.stableDetections = cloneDetections(state.pendingStableDetections);
        state.pendingStableDetections = [];
        state.pendingStableSignature = "";
        state.pendingStableCount = 0;
    }
}

function clearBoundingBoxes() {
    document.querySelectorAll(".bounding-box").forEach((node) => node.remove());
}

function handleTipsClick(event) {
    const trigger = event.target.closest("[data-tip-key]");
    if (!trigger) {
        return;
    }

    const tipKey = trigger.dataset.tipKey;
    const tip = HAND_TIPS[tipKey];
    if (!tip) {
        return;
    }

    elements.tipsTitle.textContent = tip.title;
    elements.tipsBody.textContent = tip.body;
    elements.tipsContainer.classList.remove("hidden");
}

function hideTips() {
    elements.tipsTitle.textContent = "";
    elements.tipsBody.textContent = "";
    elements.tipsContainer.classList.add("hidden");
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

function escapeHtmlAttribute(value) {
    return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
