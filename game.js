// Tiny Snack Rush
// A self-contained cooking time-management game using image crops from the supplied art.

const DAY_LENGTH = 60;
const MAX_CUSTOMERS = 2;
const MAIN_CHARACTER_FRONT = "assets/main-character.png";
const MAIN_CHARACTER_BACK = "assets/main-character-back.png";
const MAIN_CHARACTER_STRESSED = "assets/main-character-stressed.png";
const MAIN_CHARACTER_SAD = "assets/main-character-sad.png";
const MAIN_CHARACTER_ARRIVAL_DELAY = 700;

const foods = {
  noodle: {
    name: "Noodle Cup",
    img: "assets/station-noodle.png",
    cookTime: 3.2,
    expireTime: 9,
    coins: 18,
    canServeEarly: true
  },
  melon: {
    name: "Melon Drink",
    img: "assets/station-melon.png",
    cookTime: 0,
    expireTime: 12,
    coins: 12
  },
  ice: {
    name: "Iced Dessert",
    img: "assets/station-ice.png",
    cookTime: 1.1,
    expireTime: 5.5,
    coins: 16,
    melts: true
  },
  dumpling: {
    name: "Dumplings",
    img: "assets/station-dumpling.png",
    cookTime: 2.5,
    expireTime: 9,
    coins: 17
  },
  milk: {
    name: "Milk Cup",
    img: "assets/station-milk.png",
    cookTime: 1.7,
    expireTime: 10,
    coins: 15
  }
};

const customerTypes = [
  { key: "client-1", img: "assets/clients/client-1.png", angryImg: "assets/clients/client-1-angry.png", maxAngryImg: "assets/clients/client-1-angry-max.png", happyImg: "assets/clients/client-1-happy.png" },
  { key: "client-2", img: "assets/clients/client-2.png", angryImg: "assets/clients/client-2-angry.png", maxAngryImg: "assets/clients/client-2-angry-max.png", happyImg: "assets/clients/client-2-happy.png" },
  { key: "client-3", img: "assets/clients/client-3.png", angryImg: "assets/clients/client-3-angry.png", maxAngryImg: "assets/clients/client-3-angry-max.png", happyImg: "assets/clients/client-3-happy.png" },
  { key: "client-4", img: "assets/clients/client-4.png", angryImg: "assets/clients/client-4-angry.png", maxAngryImg: "assets/clients/client-4-angry-max.png", happyImg: "assets/clients/client-4-happy.png" },
  { key: "client-5", img: "assets/clients/client-5.png", angryImg: "assets/clients/client-5-angry.png", maxAngryImg: "assets/clients/client-5-angry-max.png", happyImg: "assets/clients/client-5-happy.png" }
];

const dom = {
  stage: document.querySelector("#gameStage"),
  customerLane: document.querySelector("#customerLane"),
  floatingLayer: document.querySelector("#floatingLayer"),
  finalCountdown: document.querySelector("#finalCountdown"),
  heldFood: document.querySelector("#heldFood"),
  trashZone: document.querySelector("#trashZone"),
  coinCount: document.querySelector("#coinCount"),
  servedCount: document.querySelector("#servedCount"),
  timerMask: document.querySelector("#timerMask"),
  timerClockOverlay: document.querySelector(".timer-clock-overlay"),
  mainCharacterLayer: document.querySelector(".main-character-layer"),
  homeButton: document.querySelector("#homeButton"),
  cornerRestartButton: document.querySelector("#cornerRestartButton"),
  startOverlay: document.querySelector("#startOverlay"),
  resultOverlay: document.querySelector("#resultOverlay"),
  startButton: document.querySelector("#startButton"),
  restartButton: document.querySelector("#restartButton"),
  resultCoins: document.querySelector("#resultCoins"),
  resultServed: document.querySelector("#resultServed"),
  resultMissed: document.querySelector("#resultMissed"),
  stations: [...document.querySelectorAll(".station")]
};

const state = {
  running: false,
  muted: false,
  timeLeft: DAY_LENGTH,
  coins: 0,
  served: 0,
  missed: 0,
  customers: [],
  stations: {},
  nextCustomerAt: 0,
  lastFrame: 0,
  pointer: { x: 0, y: 0 },
  held: null,
  pendingDrag: null,
  clockPulseTimeout: null,
  errorFeedbackTimeout: null,
  timerFlashTimeout: null,
  lastCountdownSecond: null,
  halfClockPulsed: false,
  mainCharacterMotionId: 0,
  mainCharacterTimers: [],
  mainCharacterSadUntil: 0,
  mainCharacterSadTimer: null,
  customerId: 0
};

dom.stations.forEach((station) => {
  state.stations[station.dataset.food] = {
    foodId: station.dataset.food,
    element: station,
    status: "idle",
    elapsed: 0,
    readyElapsed: 0
  };
});

dom.startButton.addEventListener("click", startGame);
dom.restartButton.addEventListener("click", startGame);
dom.homeButton.addEventListener("click", returnToWelcome);
dom.cornerRestartButton.addEventListener("click", returnToWelcome);
dom.timerClockOverlay.addEventListener("animationend", () => {
  dom.timerClockOverlay.classList.remove("is-pulsing");
});

dom.trashZone.addEventListener("pointerup", () => {
  if (state.held) {
    discardHeldFood();
  }
});

dom.stations.forEach((stationElement) => {
  stationElement.addEventListener("click", (event) => {
    // Pointer drags also trigger click in some browsers, so the dragging flag guards double action.
    if (stationElement.dataset.dragging === "true") {
      stationElement.dataset.dragging = "false";
      return;
    }
    handleStationTap(stationElement.dataset.food);
    event.preventDefault();
  });

  stationElement.addEventListener("pointerdown", (event) => {
    const station = state.stations[stationElement.dataset.food];
    const canLift = station.status === "ready"
      || station.status === "ruined"
      || (station.foodId === "noodle" && station.status === "cooking");
    if (!state.running || state.held || !canLift) return;
    stationElement.setPointerCapture(event.pointerId);
    stationElement.dataset.dragging = "false";
    state.pendingDrag = {
      station,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    event.preventDefault();
  });

  stationElement.addEventListener("pointermove", (event) => {
    if (state.pendingDrag && state.pendingDrag.pointerId === event.pointerId && !state.held) {
      const distance = Math.hypot(event.clientX - state.pendingDrag.startX, event.clientY - state.pendingDrag.startY);
      if (distance > 7) {
        beginHeldFood(state.pendingDrag.station, event.clientX, event.clientY);
      }
    }

    if (!state.held) return;
    stationElement.dataset.dragging = "true";
    moveHeldFood(event.clientX, event.clientY);
  });

  stationElement.addEventListener("pointerup", (event) => {
    if (!state.held) {
      state.pendingDrag = null;
      return;
    }
    stationElement.dataset.dragging = "true";
    moveHeldFood(event.clientX, event.clientY);
    finishServeAtPoint(event.clientX, event.clientY);
    state.pendingDrag = null;
  });
});

dom.customerLane.addEventListener("click", (event) => {
  const customerElement = event.target.closest(".customer");
  if (!customerElement || !state.held) return;
  const customer = state.customers.find((item) => String(item.id) === customerElement.dataset.id);
  if (customer) serveCustomer(customer);
});

function startGame() {
  state.running = true;
  state.timeLeft = DAY_LENGTH;
  state.coins = 0;
  state.served = 0;
  state.missed = 0;
  state.customers = [];
  state.nextCustomerAt = 3.4;
  state.customerId = 0;
  state.lastFrame = performance.now();
  state.pendingDrag = null;
  state.lastCountdownSecond = null;
  state.halfClockPulsed = false;
  clearTimeout(state.clockPulseTimeout);
  dom.timerClockOverlay.classList.remove("is-pulsing");
  clearErrorFeedback();
  clearTimerFlash();
  hideFinalCountdown();
  resetMainCharacterMotion();
  clearHeldFood();

  Object.values(state.stations).forEach((station) => {
    station.status = "idle";
    station.elapsed = 0;
    station.readyElapsed = 0;
    updateStationView(station);
  });

  dom.customerLane.innerHTML = "";
  dom.floatingLayer.innerHTML = "";
  dom.startOverlay.classList.remove("is-visible");
  dom.resultOverlay.classList.remove("is-visible");
  updateHud();
  spawnCustomer();
  state.clockPulseTimeout = setTimeout(() => {
    if (!state.running) return;
    pulseClock();
  }, 1000);
  requestAnimationFrame(gameLoop);
}

function returnToWelcome() {
  state.running = false;
  state.timeLeft = DAY_LENGTH;
  state.coins = 0;
  state.served = 0;
  state.missed = 0;
  state.customers = [];
  state.nextCustomerAt = 3.4;
  state.customerId = 0;
  state.pendingDrag = null;
  state.lastCountdownSecond = null;
  state.halfClockPulsed = false;
  clearTimeout(state.clockPulseTimeout);
  dom.timerClockOverlay.classList.remove("is-pulsing");
  clearErrorFeedback();
  clearTimerFlash();
  hideFinalCountdown();
  resetMainCharacterMotion();
  clearHeldFood();

  Object.values(state.stations).forEach((station) => {
    station.status = "idle";
    station.elapsed = 0;
    station.readyElapsed = 0;
    updateStationView(station);
  });

  dom.customerLane.innerHTML = "";
  dom.floatingLayer.innerHTML = "";
  dom.resultOverlay.classList.remove("is-visible");
  dom.startOverlay.classList.add("is-visible");
  updateHud();
}

function gameLoop(now) {
  if (!state.running) return;

  const delta = Math.min((now - state.lastFrame) / 1000, 0.1);
  state.lastFrame = now;
  state.timeLeft = Math.max(0, state.timeLeft - delta);

  updateStations(delta);
  updateCustomers(delta);
  maybeSpawnCustomer();
  updateHalfClockPulse();
  updateHud();
  updateFinalCountdown();

  if (state.timeLeft <= 0) {
    endGame();
    return;
  }

  requestAnimationFrame(gameLoop);
}

function updateHalfClockPulse() {
  if (state.halfClockPulsed || state.timeLeft > DAY_LENGTH / 2) return;
  state.halfClockPulsed = true;
  pulseClock();
}

function pulseClock() {
  dom.timerClockOverlay.classList.remove("is-pulsing");
  dom.timerClockOverlay.offsetHeight;
  dom.timerClockOverlay.classList.add("is-pulsing");
}

function updateStations(delta) {
  Object.values(state.stations).forEach((station) => {
    const food = foods[station.foodId];

    if (station.status === "cooking") {
      station.elapsed += delta;
      if (station.elapsed >= food.cookTime) {
        station.status = "ready";
        station.readyElapsed = 0;
        station.elapsed = food.cookTime;
        playTone(640, 0.06);
      }
    } else if (station.status === "ready") {
      station.readyElapsed += delta;
      if (station.readyElapsed >= food.expireTime) {
        station.status = "ruined";
        station.readyElapsed = food.expireTime;
        popText("ruined", station.element, true);
        playTone(160, 0.12);
      }
    }

    updateStationView(station);
  });
}

function updateStationView(station) {
  const food = foods[station.foodId];
  const element = station.element;
  const status = element.querySelector(".station-status");
  const progress = element.querySelector(".station-progress span");
  const meltLayer = element.querySelector(".melt-layer");

  element.classList.toggle("is-busy", station.status === "cooking");
  element.classList.toggle("is-ready", station.status === "ready");
  element.classList.toggle("is-ruined", station.status === "ruined");
  element.classList.toggle("is-selected", state.held?.originStation === station.foodId);

  if (station.status === "idle") {
    status.textContent = "tap";
    progress.style.width = "0%";
    meltLayer.style.height = "0%";
  } else if (station.status === "cooking") {
    const amount = Math.min(1, station.elapsed / food.cookTime);
    status.textContent = food.canServeEarly ? "cooking" : "wait";
    progress.style.width = `${amount * 100}%`;
    meltLayer.style.height = "0%";
  } else if (station.status === "ready") {
    const freshness = 1 - Math.min(1, station.readyElapsed / food.expireTime);
    status.textContent = food.melts ? "serve" : "ready";
    progress.style.width = `${freshness * 100}%`;
    meltLayer.style.height = "0%";
  } else {
    status.textContent = "clean";
    progress.style.width = "100%";
    meltLayer.style.height = "0%";
  }
}

function handleStationTap(foodId) {
  if (!state.running) return;
  const station = state.stations[foodId];

  if (state.held) {
    return;
  }

  if (station.status === "idle") {
    station.status = foods[foodId].cookTime <= 0 ? "ready" : "cooking";
    station.elapsed = 0;
    station.readyElapsed = 0;
    playTone(340, 0.05);
  } else if (station.status === "ready") {
    const rect = station.element.getBoundingClientRect();
    beginHeldFood(station, rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else if (station.status === "cooking" && foodId === "noodle") {
    const rect = station.element.getBoundingClientRect();
    beginHeldFood(station, rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else if (station.status === "ruined") {
    const rect = station.element.getBoundingClientRect();
    beginHeldFood(station, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  updateStationView(station);
}

function beginHeldFood(station, x, y) {
  const food = foods[station.foodId];
  const isEarly = station.foodId === "noodle" && station.status === "cooking";
  const isRuined = station.status === "ruined";
  const remainingFreshness = station.status === "ready"
    ? Math.max(0, food.expireTime - station.readyElapsed)
    : 0;

  state.held = {
    foodId: station.foodId,
    isEarly,
    isRuined,
    originStation: station.foodId,
    previousStatus: station.status,
    previousElapsed: station.elapsed,
    previousReadyElapsed: station.readyElapsed,
    remainingFreshness
  };

  // Remove the item from the station while it is in the player's hand.
  station.status = "idle";
  station.elapsed = 0;
  station.readyElapsed = 0;
  updateStationView(station);

  dom.heldFood.innerHTML = `<img src="${food.img}" alt="">`;
  dom.heldFood.classList.toggle("is-early", isEarly);
  dom.heldFood.classList.toggle("is-ruined", isRuined);
  dom.heldFood.hidden = false;
  moveHeldFood(x, y);
  dom.trashZone.classList.add("is-hot");
}

function moveHeldFood(x, y) {
  state.pointer = { x, y };
  dom.heldFood.style.left = `${x}px`;
  dom.heldFood.style.top = `${y}px`;
}

function finishServeAtPoint(x, y) {
  if (state.held?.isRuined) {
    if (isPointInsideElement(x, y, dom.trashZone)) {
      discardHeldFood();
    } else {
      returnHeldFood();
    }
    return;
  }

  const customer = customerAtPoint(x, y);
  if (customer) {
    serveCustomer(customer);
  } else if (isPointInsideElement(x, y, dom.trashZone)) {
    discardHeldFood();
  } else {
    returnHeldFood();
  }
}

function customerAtPoint(x, y) {
  return state.customers.find((customer) => {
    return customer.element && isPointInsideElement(x, y, customer.element);
  });
}

function isPointInsideElement(x, y, element) {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function returnHeldFood() {
  if (!state.held) return;
  const station = state.stations[state.held.originStation];

  // Returning an item preserves its timer so accidental drops do not feel punishing.
  station.status = state.held.previousStatus;
  station.elapsed = state.held.previousElapsed;
  station.readyElapsed = state.held.previousReadyElapsed;
  updateStationView(station);
  clearHeldFood();
}

function clearHeldFood() {
  state.held = null;
  dom.heldFood.hidden = true;
  dom.heldFood.innerHTML = "";
  dom.heldFood.classList.remove("is-early");
  dom.heldFood.classList.remove("is-ruined");
  dom.trashZone.classList.remove("is-hot");
  Object.values(state.stations).forEach(updateStationView);
}

function discardHeldFood() {
  if (!state.held) return;
  const wasRuined = state.held.isRuined;
  const originElement = state.stations[state.held.originStation]?.element;
  clearHeldFood();
  popText(wasRuined ? "clean" : "trash", wasRuined && originElement ? originElement : dom.trashZone, !wasRuined);
}

function serveCustomer(customer) {
  if (!state.held || customer.leaving || customer.isBeingServed) return;
  if (state.held.isRuined) {
    returnHeldFood();
    return;
  }

  const held = state.held;
  const wantedIndex = customer.orders.findIndex((order) => order.foodId === held.foodId && !order.done);
  const isCorrect = wantedIndex >= 0 && !held.isEarly;

  if (!isCorrect) {
    customer.patience = Math.max(0, customer.patience - customer.maxPatience * 0.25);
    triggerCustomerMaxAnger(customer);
    playErrorFeedback();
    popText(held.isEarly ? "too soon" : "wrong", customer.element, true);
    playTone(180, 0.1);
    clearHeldFood();
    renderCustomer(customer);
    return;
  }

  customer.orders[wantedIndex].done = true;
  customer.isBeingServed = true;
  animateMainCharacterToCustomer(customer);
  popText("nice", customer.element, false, -28);
  playTone(740, 0.07);
  clearHeldFood();

  const allDone = customer.orders.every((order) => order.done);
  if (allDone) {
    scheduleServedCustomerReaction(customer, () => completeCustomer(customer));
  } else {
    scheduleServedCustomerReaction(customer, () => {
      customer.isBeingServed = false;
      triggerCustomerHappy(customer);
      customer.patience = Math.min(customer.maxPatience, customer.patience + 2.5);
      renderCustomer(customer);
    });
  }
}

function completeCustomer(customer) {
  const base = customer.orders.reduce((sum, order) => sum + foods[order.foodId].coins, 0);
  const speedBonus = Math.round((customer.patience / customer.maxPatience) * (8 + customer.orders.length * 4));
  const earned = base + speedBonus;

  state.coins += earned;
  state.served += 1;
  customer.leaving = true;
  customer.isBeingServed = false;
  triggerCustomerHappy(customer);
  customer.element.classList.add("is-served");
  popText(`+${earned}`, customer.element, false, 42, "is-money");
  playTone(920, 0.08);

  setTimeout(() => removeCustomer(customer.id, false), 1180);
  updateHud();
}

function updateCustomers(delta) {
  state.customers.forEach((customer) => {
    if (customer.leaving || customer.isBeingServed) return;
    customer.patience -= delta;

    if (customer.patience <= 0) {
      missCustomer(customer);
    } else {
      renderCustomer(customer);
    }
  });
}

function missCustomer(customer) {
  if (customer.leaving) return;
  state.missed += 1;
  customer.leaving = true;
  const art = customer.element?.querySelector(".customer-art");
  if (art) art.src = customer.type.maxAngryImg;
  customer.element.classList.add("is-leaving", "is-angry");
  triggerMainCharacterSad();
  playErrorFeedback();
  popText("miss", customer.element, true);
  playTone(130, 0.15);
  setTimeout(() => removeCustomer(customer.id, false), 520);
}

function removeCustomer(id) {
  const index = state.customers.findIndex((customer) => customer.id === id);
  if (index < 0) return;
  const [customer] = state.customers.splice(index, 1);
  customer.element?.remove();
  updateMainCharacterMood();
}

function maybeSpawnCustomer() {
  if (state.timeLeft <= 2 || state.customers.length >= MAX_CUSTOMERS) return;

  const elapsed = DAY_LENGTH - state.timeLeft;
  if (elapsed < state.nextCustomerAt) return;

  spawnCustomer();

  // Arrival pacing gets tighter through the shift without becoming frantic too early.
  const progress = elapsed / DAY_LENGTH;
  const minDelay = lerp(4.2, 1.65, progress);
  const maxDelay = lerp(6.2, 2.55, progress);
  state.nextCustomerAt = elapsed + randomBetween(minDelay, maxDelay);
}

function spawnCustomer() {
  const openSlot = firstOpenSlot();
  if (openSlot === -1) return;

  const elapsed = DAY_LENGTH - state.timeLeft;
  const activeKeys = new Set(state.customers.map((customer) => customer.type.key));
  const availableTypes = customerTypes.filter((type) => !activeKeys.has(type.key));
  const customerType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const orderCount = elapsed > 55 ? chance(0.48) + 1 : elapsed > 28 ? chance(0.28) + 1 : 1;
  const maxPatience = randomBetween(15, 20) - Math.min(3.8, elapsed / 24);
  const customer = {
    id: ++state.customerId,
    slot: openSlot,
    type: customerType,
    orders: makeOrders(orderCount),
    maxPatience,
    patience: maxPatience,
    maxAngryUntil: 0,
    happyUntil: 0,
    isBeingServed: false,
    leaving: false,
    element: null
  };

  const element = document.createElement("article");
  element.className = `customer slot-${openSlot} customer-${customerType.key}`;
  element.dataset.id = String(customer.id);
  element.innerHTML = `
    <div class="order-bubble"></div>
    <img class="customer-art" src="${customerType.img}" alt="">
    <div class="patience-wrap"><div class="patience-fill"></div></div>
  `;

  customer.element = element;
  dom.customerLane.appendChild(element);
  state.customers.push(customer);
  renderCustomer(customer);
}

function firstOpenSlot() {
  for (let slot = 0; slot < MAX_CUSTOMERS; slot += 1) {
    if (!state.customers.some((customer) => customer.slot === slot)) return slot;
  }
  return -1;
}

function makeOrders(count) {
  const ids = Object.keys(foods);
  const orders = [];

  for (let index = 0; index < count; index += 1) {
    const foodId = ids[Math.floor(Math.random() * ids.length)];
    orders.push({ foodId, done: false });
  }

  return orders;
}

function renderCustomer(customer) {
  if (!customer.element) return;
  const patienceRatio = Math.max(0, customer.patience / customer.maxPatience);
  const bubble = customer.element.querySelector(".order-bubble");
  const patienceFill = customer.element.querySelector(".patience-fill");
  const art = customer.element.querySelector(".customer-art");
  const isAnnoyed = patienceRatio <= 0.5;
  const isMaxAngry = patienceRatio < 0.22 || customer.maxAngryUntil > performance.now();
  const isHappy = customer.happyUntil > performance.now();

  bubble.innerHTML = customer.orders.map((order) => {
    const food = foods[order.foodId];
    return `
      <span class="order-icon ${order.done ? "is-done" : ""}">
        <img src="${food.img}" alt="${food.name}">
      </span>
    `;
  }).join("");

  patienceFill.style.width = `${patienceRatio * 100}%`;
  if (art) art.src = isHappy ? customer.type.happyImg : isMaxAngry ? customer.type.maxAngryImg : isAnnoyed ? customer.type.angryImg : customer.type.img;
  customer.element.classList.toggle("is-annoyed", isAnnoyed);
  customer.element.classList.toggle("is-angry", isMaxAngry);
  updateMainCharacterMood();
}

function triggerCustomerMaxAnger(customer) {
  customer.maxAngryUntil = performance.now() + 1200;
}

function triggerCustomerHappy(customer) {
  customer.happyUntil = performance.now() + 1200;
  const art = customer.element?.querySelector(".customer-art");
  if (art) art.src = customer.type.happyImg;
  updateMainCharacterMood(true);
}

function scheduleServedCustomerReaction(customer, reaction) {
  setTimeout(() => {
    if (!state.running || !state.customers.includes(customer) || !customer.element || customer.leaving) return;
    reaction();
    updateMainCharacterMood(true);
  }, MAIN_CHARACTER_ARRIVAL_DELAY);
}

function animateMainCharacterToCustomer(customer) {
  const layer = dom.mainCharacterLayer;
  if (!layer) return;

  clearMainCharacterTimers();
  const token = ++state.mainCharacterMotionId;
  const targetX = getCustomerSlideOffset(customer);

  layer.classList.add("is-serving");
  layer.src = getMainCharacterFrontImage();
  layer.style.transition = "none";
  layer.style.transform = "translateX(0%)";
  layer.offsetHeight;

  scheduleMainCharacterStep(token, 45, () => {
    layer.src = MAIN_CHARACTER_BACK;
  });

  scheduleMainCharacterStep(token, 70, () => {
    layer.style.transition = "transform 0.63s cubic-bezier(0.2, 0.76, 0.22, 1)";
    layer.style.transform = `translateX(${targetX}%)`;
  });

  scheduleMainCharacterStep(token, MAIN_CHARACTER_ARRIVAL_DELAY, () => {
    layer.src = getMainCharacterFrontImage();
  });

  scheduleMainCharacterStep(token, 720, () => {
    layer.style.transition = "transform 0.66s cubic-bezier(0.28, 0, 0.18, 1)";
    layer.style.transform = "translateX(0%)";
  });

  scheduleMainCharacterStep(token, 1410, () => {
    layer.style.transition = "";
    layer.style.transform = "";
    layer.classList.remove("is-serving");
    layer.src = getMainCharacterFrontImage();
  });
}

function getMainCharacterFrontImage() {
  if (state.mainCharacterSadUntil > performance.now()) return MAIN_CHARACTER_SAD;
  return hasAngryCustomer() ? MAIN_CHARACTER_STRESSED : MAIN_CHARACTER_FRONT;
}

function triggerMainCharacterSad() {
  state.mainCharacterSadUntil = performance.now() + 950;
  clearTimeout(state.mainCharacterSadTimer);
  state.mainCharacterSadTimer = setTimeout(() => {
    state.mainCharacterSadTimer = null;
    updateMainCharacterMood(true);
  }, 970);
  updateMainCharacterMood(true);
}

function hasAngryCustomer() {
  const now = performance.now();
  return state.customers.some((customer) => {
    if (customer.leaving) return false;
    const patienceRatio = Math.max(0, customer.patience / customer.maxPatience);
    return patienceRatio <= 0.5 || customer.maxAngryUntil > now;
  });
}

function updateMainCharacterMood(force = false) {
  const layer = dom.mainCharacterLayer;
  if (!layer) return;
  if (!force && layer.classList.contains("is-serving")) return;
  layer.src = getMainCharacterFrontImage();
}

function getCustomerSlideOffset(customer) {
  const stageRect = dom.stage.getBoundingClientRect();
  const customerRect = customer.element?.getBoundingClientRect();
  if (!stageRect.width || !customerRect) {
    return customer.slot === 0 ? -10 : 9;
  }

  const customerCenter = ((customerRect.left + customerRect.width / 2 - stageRect.left) / stageRect.width) * 100;
  return Math.max(-12, Math.min(12, (customerCenter - 52.4) * 0.5));
}

function clearMainCharacterTimers() {
  state.mainCharacterTimers.forEach((timer) => clearTimeout(timer));
  state.mainCharacterTimers = [];
}

function scheduleMainCharacterStep(token, delay, action) {
  const timer = setTimeout(() => {
    state.mainCharacterTimers = state.mainCharacterTimers.filter((item) => item !== timer);
    if (token === state.mainCharacterMotionId) action();
  }, delay);
  state.mainCharacterTimers.push(timer);
}

function resetMainCharacterMotion() {
  state.mainCharacterMotionId += 1;
  clearMainCharacterTimers();
  clearTimeout(state.mainCharacterSadTimer);
  state.mainCharacterSadTimer = null;
  state.mainCharacterSadUntil = 0;
  if (!dom.mainCharacterLayer) return;
  dom.mainCharacterLayer.src = MAIN_CHARACTER_FRONT;
  dom.mainCharacterLayer.style.transition = "";
  dom.mainCharacterLayer.style.transform = "";
  dom.mainCharacterLayer.classList.remove("is-serving");
}

function playErrorFeedback() {
  clearErrorFeedback();
  dom.stage.offsetHeight;
  dom.stage.classList.add("is-error-feedback");
  state.errorFeedbackTimeout = setTimeout(clearErrorFeedback, 420);
}

function clearErrorFeedback() {
  clearTimeout(state.errorFeedbackTimeout);
  state.errorFeedbackTimeout = null;
  dom.stage.classList.remove("is-error-feedback");
}

function updateFinalCountdown() {
  const second = Math.ceil(state.timeLeft);
  if (state.timeLeft <= 0 || second > 5) {
    hideFinalCountdown();
    state.lastCountdownSecond = null;
    return;
  }

  dom.finalCountdown.textContent = second;
  if (second !== state.lastCountdownSecond) {
    dom.finalCountdown.classList.remove("is-visible");
    dom.finalCountdown.offsetHeight;
    dom.finalCountdown.classList.add("is-visible");
    if (second <= 3) playTimerFlash();
    state.lastCountdownSecond = second;
  }
}

function hideFinalCountdown() {
  dom.finalCountdown.classList.remove("is-visible");
  dom.finalCountdown.textContent = "";
}

function playTimerFlash() {
  clearTimerFlash();
  dom.stage.offsetHeight;
  dom.stage.classList.add("is-timer-flash");
  state.timerFlashTimeout = setTimeout(clearTimerFlash, 390);
}

function clearTimerFlash() {
  clearTimeout(state.timerFlashTimeout);
  state.timerFlashTimeout = null;
  dom.stage.classList.remove("is-timer-flash");
}

function updateHud() {
  const ratio = state.timeLeft / DAY_LENGTH;
  dom.coinCount.textContent = formatBills(state.coins);
  dom.servedCount.textContent = state.served;
  dom.timerMask.style.height = `${(1 - Math.max(0, ratio)) * 100}%`;
}

function endGame() {
  state.running = false;
  clearTimeout(state.clockPulseTimeout);
  clearErrorFeedback();
  clearTimerFlash();
  hideFinalCountdown();
  resetMainCharacterMotion();
  clearHeldFood();
  state.customers.forEach((customer) => {
    if (!customer.leaving) state.missed += 1;
    customer.element?.remove();
  });
  state.customers = [];

  dom.resultCoins.textContent = formatBills(state.coins);
  dom.resultServed.textContent = state.served;
  dom.resultMissed.textContent = state.missed;
  dom.resultOverlay.classList.add("is-visible");
}

function popText(text, anchor, isBad, offsetY = 0, extraClass = "") {
  const stageRect = dom.stage.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const bubble = document.createElement("span");
  const x = anchorRect.left + anchorRect.width / 2 - stageRect.left;
  const y = anchorRect.top + anchorRect.height * 0.25 - stageRect.top + offsetY;

  bubble.className = `float-text ${isBad ? "is-bad" : ""} ${extraClass}`.trim();
  bubble.textContent = text;
  bubble.style.setProperty("--x", `${x}px`);
  bubble.style.setProperty("--y", `${y}px`);
  dom.floatingLayer.appendChild(bubble);
  setTimeout(() => bubble.remove(), 900);
}

function playTone(frequency, seconds) {
  if (state.muted) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = playTone.context || new AudioContext();
  playTone.context = context;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.045;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
  oscillator.stop(context.currentTime + seconds);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function chance(probability) {
  return Math.random() < probability ? 1 : 0;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function formatBills(value) {
  return Math.max(0, Math.round(value)).toLocaleString("en-US");
}
