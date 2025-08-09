const incomeSlider = document.getElementById('incomeSlider');
const incomeInput = document.getElementById('incomeInput');
const expensesSlider = document.getElementById('expensesSlider');
const expensesInput = document.getElementById('expensesInput');
const interestSlider = document.getElementById('interestSlider');
const interestInput = document.getElementById('interestInput');
const termSlider = document.getElementById('termSlider');
const termInput = document.getElementById('termInput');
const bufferToggle = document.getElementById('bufferToggle');
const resultsDiv = document.getElementById('results');

const syncInputs = (slider, input, isDecimal = false) => {
  slider.addEventListener('input', () => {
    input.value = isDecimal ? parseFloat(slider.value).toFixed(2) : slider.value;
    calculate();
  });
  input.addEventListener('input', () => {
    slider.value = input.value;
    calculate();
  });
};

syncInputs(incomeSlider, incomeInput);
syncInputs(expensesSlider, expensesInput);
syncInputs(interestSlider, interestInput, true);
syncInputs(termSlider, termInput);

document.querySelectorAll('.info-icon').forEach(icon => {
  icon.addEventListener('click', () => {
    const tooltip = icon.parentElement.parentElement.querySelector('.tooltip');
    tooltip.textContent = icon.dataset.tooltip;
    tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
  });
});

let borrowingChart, repaymentChart;

function initCharts() {
  const ctx1 = document.getElementById('borrowingChart').getContext('2d');

  borrowingChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: ['Normal', 'With Buffer'],
      datasets: [{
        label: 'Borrowing Power ($)',
        backgroundColor: ['#4CAF50', '#FF9800'],
        data: [0, 0]
      }]
    },
    options: { responsive: true }
  });

}

function updateCharts(bp, bpBuffer, piMonthly, ioMonthly) {
  borrowingChart.data.datasets[0].data = [bp, bpBuffer];
  borrowingChart.update();
}

function calculate() {
  const income = parseFloat(incomeInput.value);
  const expenses = parseFloat(expensesInput.value);
  const interestRate = parseFloat(interestInput.value) / 100;
  const termYears = parseInt(termInput.value);
  const buffer = bufferToggle.checked ? 0.03 : 0;

  if (expenses * 12 >= income) {
    resultsDiv.innerHTML = `<span style="color:red;">Error: Monthly expenses exceed or equal annual income!</span>`;
    updateCharts(0, 0, 0, 0);
    return;
  }

  const availableIncomePerMonth = (income / 12) - expenses;
  const monthlyRate = interestRate / 12;

  const borrowingPower = (availableIncomePerMonth * (Math.pow(1 + monthlyRate, termYears * 12) - 1)) /
                         (monthlyRate * Math.pow(1 + monthlyRate, termYears * 12));

  const monthlyRateWithBuffer = (interestRate + buffer) / 12;
  const borrowingPowerWithBuffer = (availableIncomePerMonth * (Math.pow(1 + monthlyRateWithBuffer, termYears * 12) - 1)) /
                                  (monthlyRateWithBuffer * Math.pow(1 + monthlyRateWithBuffer, termYears * 12));

  const piMonthly = borrowingPower * (monthlyRate * Math.pow(1 + monthlyRate, termYears * 12)) /
                    (Math.pow(1 + monthlyRate, termYears * 12) - 1);
  const ioMonthly = borrowingPower * monthlyRate;

  resultsDiv.innerHTML = `
    Borrowing Power: $${borrowingPower.toFixed(0)}<br />
    Borrowing Power (With Buffer): $${borrowingPowerWithBuffer.toFixed(0)}<br />
    Monthly Repayment (P&I): $${piMonthly.toFixed(0)}<br />
    Monthly Repayment (Interest Only): $${ioMonthly.toFixed(0)}
  `;

  updateCharts(borrowingPower, borrowingPowerWithBuffer, piMonthly, ioMonthly);
}

initCharts();
calculate();