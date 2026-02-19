function toggleSection(id) {
    const section = document.getElementById(id);

    if (section.classList.contains("active")) {
        section.style.maxHeight = "0px";
        section.classList.remove("active");
    } else {
        section.style.maxHeight = section.scrollHeight + "px";
        section.classList.add("active");

        if (id === "monthlySection") {
            setTimeout(renderMonthlyChart, 300);
        }
    }
}

function toggleFullscreen() {
    const container = document.getElementById("mapContainer");

    if (!document.fullscreenElement) {
        container.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function switchMap(mapPath) {
    const iframe = document.getElementById("mapFrame");
    iframe.src = mapPath;
}

let monthlyChartInstance = null;

async function renderMonthlyChart() {

    if (monthlyChartInstance) return;

    const response = await fetch("assets/monthly_counts.json");
    const monthlyCounts = await response.json();

    const ctx = document.getElementById('monthlyChart');

    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [
                'Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'
            ],
            datasets: [{
                label: 'Accidents',
                data: monthlyCounts,
                backgroundColor: '#6C63FF',
                borderColor: '#000',
                borderWidth: 3,
                hoverBackgroundColor: '#4A42E8'
            }]
        },
        options: {
            responsive: true,
            animation: {
                duration: 900,
                easing: 'easeOutCubic'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#000',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fff',
                    borderWidth: 2,
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#000',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Accidents',
                        color: '#000',
                        font: {
                            weight: 'bold',
                            size: 14
                        }
                    },
                    ticks: {
                        color: '#000',
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });
}
