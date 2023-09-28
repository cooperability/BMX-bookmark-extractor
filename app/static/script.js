document.addEventListener("DOMContentLoaded", () => {
  const urlForm = document.getElementById("urlForm");
  const summaryElement = document.getElementById("summary");
  const entitiesElement = document.getElementById("entities");
  const sentimentElement = document.getElementById("sentiment");
  const rawContentElement = document.getElementById("rawContent");

  urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Display a loading message to the user
    summaryElement.textContent = "Fetching and processing data...";

    const urlInput = document.getElementById("urlInput").value;
    const lengthInput = document.getElementById("length").value;

    const response = await fetch(
      `/process?url=${encodeURIComponent(urlInput)}&length=${lengthInput}`
    );
    const data = await response.json();

    summaryElement.textContent = data.summary;
    entitiesElement.innerHTML = data.entities
      .map((entity) => `<li>${entity}</li>`)
      .join("");
    sentimentElement.textContent = data.sentiment;
    rawContentElement.textContent = data.rawContent;
  });

  // Update displayed summary length when the slider is moved
  document.getElementById("length").addEventListener("input", (e) => {
    document.getElementById("lengthValue").textContent = e.target.value;
  });
});
