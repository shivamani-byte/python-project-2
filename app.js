/* Bunny Budget front-end logic.
   Data comes from the Flask API (MySQL).
   Slide navigation lives in script.js. */
(() => {
    "use strict";

    // Filled from the database (GET /api/categories) when the page loads.
    let CATEGORIES = [];

    const $ = (id) => document.getElementById(id);
    const money = (value) => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);

    const today = new Date();
    const localDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };
    const currentMonth = () => localDate(today).slice(0, 7);
    const monthOf = (date) => date.slice(0, 7);

    // ---------- talking to the Flask backend ----------
    async function api(path, options = {}) {
        let response;
        try {
            response = await fetch("/api" + path, {
                headers: { "Content-Type": "application/json" },
                ...options
            });
        } catch {
            throw new Error("Cannot reach the server. Is Flask running?");
        }

        let data = null;
        try { data = await response.json(); } catch { /* no JSON body */ }

        if (!response.ok) {
            throw new Error((data && data.error) || `Request failed (${response.status}).`);
        }
        return data;
    }

    let expenses = [];
    let budgets = {};
    let categoryChart = null;
    let monthlyChart = null;

    async function loadCategories() {
        CATEGORIES = await api("/categories");
        ["category", "filter-category"].forEach(id => {
            const select = $(id);
            // keep the first option ("Choose category" / "All categories")
            select.replaceChildren(select.options[0]);
            CATEGORIES.forEach(name => {
                const option = document.createElement("option");
                option.value = option.textContent = name;
                select.appendChild(option);
            });
        });
    }

    async function loadData() {
        const [expenseRows, budgetMap] = await Promise.all([
            api("/expenses"),
            api("/budgets")
        ]);
        expenses = expenseRows;
        budgets = budgetMap;
    }

    function selectedMonth() {
        return $("report-month").value || currentMonth();
    }

    function expensesForMonth(month) {
        return expenses.filter(e => monthOf(e.date) === month);
    }

    function totalOf(items) {
        // Sum integer paise to avoid common floating-point addition errors.
        const paise = items.reduce((sum, e) =>
            sum + Math.round(Number(e.amount) * 100), 0);
        return paise / 100;
    }

    function groupByCategory(items) {
        const result = {};
        items.forEach(e => {
            result[e.category] = (result[e.category] || 0) +
                Math.round(e.amount * 100);
        });
        Object.keys(result).forEach(k => result[k] /= 100);
        return result;
    }

    function monthLabel(month) {
        const [year, m] = month.split("-").map(Number);
        return new Date(year, m - 1, 1).toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit"
        });
    }

    function renderSummary() {
        const month = selectedMonth();
        const monthly = expensesForMonth(month);
        const spent = totalOf(monthly);
        const budget = Number(budgets[month]) || 0;
        const remaining = budget - spent;
        const [year, monthNumber] = month.split("-").map(Number);
        const isCurrentMonth = month === currentMonth();
        const days = isCurrentMonth
            ? today.getDate()
            : new Date(year, monthNumber, 0).getDate();

        $("monthly-total").textContent = money(spent);
        $("all-time-total").textContent = money(totalOf(expenses));
        $("monthly-count").textContent = monthly.length.toLocaleString("en-IN");
        $("daily-average").textContent = money(days > 0 ? spent / days : 0);

        $("budget-amount").value = budgets[month] ?? "";
        $("budget-total").textContent = money(budget);
        $("budget-spent").textContent = money(spent);
        $("budget-remaining").textContent = money(remaining);

        const progress = budget > 0 ? (spent / budget) * 100 : 0;
        $("budget-progress").style.width = `${Math.min(progress, 100)}%`;
        $("budget-progress").classList.toggle("over-budget", budget > 0 && spent > budget);

        if (!budget) {
            $("budget-message").textContent = "Set a budget to start tracking your progress.";
        } else if (remaining < 0) {
            $("budget-message").textContent =
                `You are ${money(Math.abs(remaining))} over budget. Consider reviewing your spending.`;
        } else {
            $("budget-message").textContent =
                `${money(remaining)} remaining · ${Math.min(progress, 100).toFixed(1)}% of budget used.`;
        }
    }

    function renderCategoryChart() {
        const totals = groupByCategory(expensesForMonth(selectedMonth()));
        const labels = Object.keys(totals);
        const values = labels.map(k => totals[k]);

        $("pie-empty").classList.toggle("hidden", labels.length > 0);
        $("category-chart").classList.toggle("hidden", labels.length === 0);

        if (categoryChart) categoryChart.destroy();
        if (!labels.length) return;

        categoryChart = new Chart($("category-chart"), {
            type: "pie",
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        "#a78bfa", "#f6a6c1", "#f6cc83",
                        "#8dd8c5", "#91b8f5", "#f3a98e",
                        "#c5a6e8", "#f2c6a8", "#c4c4d8"
                    ],
                    borderColor: "#ffffff",
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { padding: 16, usePointStyle: true }
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                                const share = sum ? context.parsed / sum * 100 : 0;
                                return `${context.label}: ${money(context.parsed)} (${share.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderMonthlyChart() {
        const [year, month] = selectedMonth().split("-").map(Number);
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(year, month - 1 - i, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }

        const values = months.map(m => totalOf(expensesForMonth(m)));
        const hasData = values.some(v => v > 0);

        $("bar-empty").classList.toggle("hidden", hasData);
        $("monthly-chart").classList.toggle("hidden", !hasData);

        if (monthlyChart) monthlyChart.destroy();
        if (!hasData) return;

        monthlyChart = new Chart($("monthly-chart"), {
            type: "bar",
            data: {
                labels: months.map(monthLabel),
                datasets: [{
                    label: "Expenses",
                    data: values,
                    backgroundColor: "#b6a0ed",
                    hoverBackgroundColor: "#9277ce",
                    borderRadius: 8,
                    maxBarThickness: 48
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => "₹" + Number(value).toLocaleString("en-IN")
                        },
                        grid: { color: "#f0eaf5" }
                    },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => money(context.parsed.y)
                        }
                    }
                }
            }
        });
    }

    function renderCategoryReport() {
        const body = $("category-report-body");
        body.replaceChildren();

        const totals = groupByCategory(expensesForMonth(selectedMonth()));
        const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
        const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);

        if (!rows.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 3;
            td.textContent = "No spending recorded for this month.";
            td.className = "empty-cell";
            tr.appendChild(td);
            body.appendChild(tr);
            return;
        }

        rows.forEach(([category, amount]) => {
            const tr = document.createElement("tr");
            const name = document.createElement("td");
            const total = document.createElement("td");
            const share = document.createElement("td");

            name.textContent = category;
            total.textContent = money(amount);

            share.textContent = `${grandTotal ? (amount / grandTotal * 100).toFixed(1) : "0.0"}%`;

            tr.append(name, total, share);
            body.appendChild(tr);
        });
    }

    function renderTransactions() {
        const body = $("expense-list");
        body.replaceChildren();

        const search = $("search-expense").value.trim().toLowerCase();
        const category = $("filter-category").value;
        const from = $("filter-from").value;
        const to = $("filter-to").value;

        const filtered = expenses
            .filter(e => !search ||
                e.description.toLowerCase().includes(search) ||
                (e.notes || "").toLowerCase().includes(search))
            .filter(e => !category || e.category === category)
            .filter(e => !from || e.date >= from)
            .filter(e => !to || e.date <= to)
            .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));

        $("transaction-empty").classList.toggle("hidden", filtered.length > 0);

        filtered.forEach(e => {
            const tr = document.createElement("tr");
            const values = [e.date, e.description, e.category, money(e.amount), e.notes || "—"];

            values.forEach((value, index) => {
                const td = document.createElement("td");
                td.textContent = value;
                if (index === 2) {
                    const tag = document.createElement("span");
                    tag.className = "category-tag";
                    tag.textContent = value;
                    td.replaceChildren(tag);
                }
                tr.appendChild(td);
            });

            const actions = document.createElement("td");
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "edit-button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => startEdit(e.id));

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "delete-button";
            remove.textContent = "Delete";
            remove.addEventListener("click", () => deleteExpense(e.id));

            actions.append(edit, remove);
            tr.appendChild(actions);
            body.appendChild(tr);
        });
    }

    function renderAll() {
        renderSummary();
        renderCategoryChart();
        renderMonthlyChart();
        renderCategoryReport();
        renderTransactions();
    }

    function resetForm() {
        $("expense-form").reset();
        $("expense-id").value = "";
        $("date").value = localDate(new Date());
        $("form-heading").textContent = "Add a new expense";
        $("save-expense").textContent = "+ Add expense";
        $("cancel-edit").classList.add("hidden");
    }

    function startEdit(id) {
        const e = expenses.find(item => item.id === id);
        if (!e) return;

        $("expense-id").value = e.id;
        $("description").value = e.description;
        $("amount").value = e.amount;
        $("category").value = e.category;
        $("date").value = e.date;
        $("notes").value = e.notes || "";
        $("form-heading").textContent = "Edit expense";
        $("save-expense").textContent = "Save changes";
        $("cancel-edit").classList.remove("hidden");

        // The form lives on its own slide: open it.
        if (window.showAppSlide) window.showAppSlide("add-expense");
        $("description").focus();
    }

    async function deleteExpense(id) {
        if (!confirm("Delete this expense permanently from the database?")) return;

        try {
            await api(`/expenses/${id}`, { method: "DELETE" });
            await loadData();
        } catch (err) {
            alert(err.message);
            return;
        }
        renderAll();
    }

    $("expense-form").addEventListener("submit", async event => {
        event.preventDefault();

        const description = $("description").value.trim();
        const amount = Number($("amount").value);
        const category = $("category").value;
        const date = $("date").value;
        const notes = $("notes").value.trim();
        const id = $("expense-id").value;

        if (!description || !Number.isFinite(amount) || amount <= 0 ||
            !CATEGORIES.includes(category) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            $("form-message").textContent =
                "Please enter a description, valid positive amount, category, and date.";
            return;
        }

        const payload = {
            description,
            amount: Math.round(amount * 100) / 100,
            category,
            date,
            notes
        };

        try {
            if (id) {
                await api(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            } else {
                await api("/expenses", { method: "POST", body: JSON.stringify(payload) });
            }
            await loadData();
        } catch (err) {
            $("form-message").textContent = err.message;
            return;
        }

        $("report-month").value = monthOf(date);
        resetForm();
        $("form-message").textContent = id ? "Expense updated successfully."
                                          : "Expense added successfully.";
        renderAll();
    });

    $("cancel-edit").addEventListener("click", () => {
        resetForm();
        $("form-message").textContent = "";
    });

    $("budget-form").addEventListener("submit", async event => {
        event.preventDefault();

        const amount = Number($("budget-amount").value);
        if (!Number.isFinite(amount) || amount < 0) {
            alert("Enter a valid non-negative budget.");
            return;
        }

        const month = selectedMonth();
        const rounded = Math.round(amount * 100) / 100;
        try {
            await api(`/budgets/${month}`, {
                method: "PUT",
                body: JSON.stringify({ amount: rounded })
            });
            budgets[month] = rounded;
        } catch (err) {
            alert(err.message);
            return;
        }

        renderSummary();
    });

    $("report-month").addEventListener("change", renderAll);
    ["search-expense", "filter-category", "filter-from", "filter-to"]
        .forEach(id => $(id).addEventListener("input", renderTransactions));

    // The server builds the CSV, so it always matches the database.
    $("export-csv").addEventListener("click", () => {
        window.location.href = "/api/export.csv";
    });

    $("report-month").value = currentMonth();
    $("date").value = localDate(new Date());

    Promise.all([loadCategories(), loadData()])
        .catch(err => { $("form-message").textContent = err.message; })
        .finally(renderAll);
})();
