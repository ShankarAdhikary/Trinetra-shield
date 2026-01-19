// content.js
console.log("Trinetra Shield Active");

function injectShields() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.width > 200 && img.height > 200 && !img.parentElement.querySelector('#trinetra-shield-icon')) {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            const shield = document.createElement('div');
            shield.id = 'trinetra-shield-icon';
            shield.innerText = '🛡️';
            shield.title = "Analyze with Trinetra";
            shield.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                shield.innerText = '⏳';
                chrome.runtime.sendMessage({ action: "analyze_media", src: img.src }, (response) => {
                    console.log("Analysis Result:", response);
                    shield.innerText = '🛡️';
                    if (response && response.status === 'success') {
                        alert(`Trinetra Trust Score: ${response.data.trust_score}\nRISKS: ${response.data.risk_factors.join(", ")}`);
                    } else {
                        alert("Analysis Failed or Server Offline");
                    }
                });
            });
            wrapper.appendChild(shield);
        }
    });
}

setInterval(injectShields, 2000);