document.addEventListener("DOMContentLoaded", () => {
  const urlForm = document.getElementById("urlForm");
  const summaryElement = document.getElementById("summary");
  const entitiesElement = document.getElementById("entities");
  const sentimentElement = document.getElementById("sentiment");
  const rawContentElement = document.getElementById("rawContent");

  urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const urlInput = document.getElementById("urlInput").value;
    const response = await fetch(
      `/process?url=${encodeURIComponent(urlInput)}`
    );
    const data = await response.json();

    summaryElement.textContent = data.summary;
    entitiesElement.innerHTML = data.entities
      .map((entity) => `<li>${entity}</li>`)
      .join("");
    sentimentElement.textContent = data.sentiment;
    rawContentElement.textContent = data.rawContent;
  });
});
