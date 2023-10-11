//DOM Element References
const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const summaryElement = document.getElementById("summary");
const lengthInput = document.getElementById("length");
const entitiesElement = document.getElementById("entities");
const sentimentElement = document.getElementById("sentiment");
const rawContentElement = document.getElementById("rawContent");
const moreEntitiesButton = document.getElementById("moreEntities");

let startTime = null;
const timerElement = document.createElement("span");
document.querySelector("#summary").after(timerElement);

async function fetchDataAndUpdateUI(url, length) {
  try {
    startTime = Date.now();
    const timer = setInterval(() => {
      const secondsPassed = ((Date.now() - startTime) / 1000).toFixed(1);
      timerElement.textContent = `${secondsPassed} seconds since request started.`;
    }, 100);
    const response = await fetch(
      `/process?url=${encodeURIComponent(url)}&length=${length}`
    );
    const data = await response.json();

    // Clear previous error styling if present
    summaryElement.classList.remove("error-message");

    if (data.error) {
      summaryElement.textContent = `Error: ${data.error}`;
      summaryElement.classList.add("error-message"); // Add the error styling
      return; // Early exit from the function if there's an error
    }

    summaryElement.textContent = data.summary;

    if (data.entities) {
      entitiesElement.innerHTML = data.entities
        .map(
          (entity) =>
            `<li>${entity.text} (${entity.count} times) - ${entity.label_desc}</li>`
        )
        .join("");
    } else {
      entitiesElement.innerHTML =
        "No entities found or error fetching entities.";
    }

    // const displacyDiv =
    //   document.getElementById("displacy") || document.createElement("div");
    // displacyDiv.id = "displacy";
    // displacyDiv.innerHTML = data.displacy;
    // entitiesElement.after(displacyDiv);

    sentimentElement.textContent = "Sentiment: " + data.sentiment;
    rawContentElement.textContent = data.rawContent;
    clearInterval(timer);
  } catch (error) {
    summaryElement.textContent = "Error fetching data. Please try again.";
    summaryElement.classList.add("error-message"); // Add the error styling
  }
}

urlForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  summaryElement.textContent = "Fetching and processing data...";
  fetchDataAndUpdateUI(urlInput.value, lengthInput.value);
});

// Update displayed summary length when the slider is moved
lengthInput.addEventListener("change", (e) => {
  document.getElementById("lengthValue").textContent = e.target.value;
  fetchDataAndUpdateUI(urlInput.value, e.target.value);
});

moreEntitiesButton.addEventListener("click", async () => {
  const urlInput = document.getElementById("urlInput").value;

  // Fetch top 50 entities this time
  const response = await fetch(
    `/process?url=${encodeURIComponent(urlInput)}&length=500`
  );
  const data = await response.json();

  entitiesElement.innerHTML = data.entities
    .map(
      (entity) =>
        `<li>${entity.text} (${entity.count} times) - ${entity.label_desc}</li>`
    )
    .join("");
});
