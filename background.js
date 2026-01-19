// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_media") {
        console.log("Analyze request received for:", request.src);

        // In a real scenario, we would download the image/video blob and send it.
        // For this hackathon/MVP, we might send the URL if public, 
        // or just mock the data flow by sending a "text" signal if it's local.

        // We will try to fetch the blob and send it as form data
        fetch(request.src)
            .then(res => res.blob())
            .then(blob => {
                const formData = new FormData();
                formData.append("file", blob, "analyzed_asset.jpg"); // default name

                return fetch("http://127.0.0.1:8000/verify", {
                    method: "POST",
                    body: formData
                });
            })
            .then(res => res.json())
            .then(data => {
                sendResponse({ status: "success", data: data });
            })
            .catch(err => {
                console.error("Analysis failed", err);
                sendResponse({ status: "error", error: err.toString() });
            });

        return true; // async response
    }
});