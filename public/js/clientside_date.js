document.querySelectorAll("[data-timestamp]").forEach((n) => {
    const epochTime = parseInt(n.dataset.timestamp)
    const options = JSON.parse(n.dataset.timestampoptions)
    n.innerHTML = new Intl.DateTimeFormat([], options).format(new Date(epochTime))
})