//DOM Element References
const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const summaryElement = document.getElementById("summary");
const lengthInput = document.getElementById("length");
const entitiesElement = document.getElementById("entities");
const sentimentElement = document.getElementById("sentiment");
const rawContentElement = document.getElementById("rawContent");
const moreEntitiesButton = document.getElementById("moreEntities");

async function fetchDataAndUpdateUI(url, length) {
  try {
    const response = await fetch(
      `/process?url=${encodeURIComponent(url)}&length=${length}`
    );
    const data = await response.json();

    summaryElement.textContent = data.summary;
    entitiesElement.innerHTML = data.entities
      .map(
        (entity) =>
          `<li>${entity.text} (${entity.count} times) - ${entity.label_desc}</li>`
      )
      .join("");
    const displacyDiv =
      document.getElementById("displacy") || document.createElement("div");
    displacyDiv.id = "displacy";
    displacyDiv.innerHTML = data.displacy;
    entitiesElement.after(displacyDiv);
    sentimentElement.textContent = "Sentiment: " + data.sentiment;
    rawContentElement.textContent = data.rawContent;
  } catch (error) {
    summaryElement.textContent = "Error fetching data. Please try again.";
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
