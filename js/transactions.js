const Transactions = {
    transactionsList: [],
    chartInstance: null,

    init: async () => {
        Transactions.setupEventListeners();
        await Transactions.loadTransactions();
    },

    setupEventListeners: () => {
        // Open modal
        const btnOpenAdd = document.getElementById('btn-open-add-transaction-modal');
        const modalAdd = document.getElementById('modal-add-transaction');
        const closeAdd = document.getElementById('close-add-transaction-modal');
        const cancelAdd = document.getElementById('cancel-add-transaction-modal');

        // Filter dropdown
        const periodSelect = document.getElementById('transactions-period-select');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                Transactions.renderDashboard();
                Transactions.renderTransactions();
            });
        }

        // Fechar se clicar fora do modal
        window.addEventListener('click', (e) => {
            if (e.target === modalAdd) {
                modalAdd.classList.remove('active');
            }
        });

        if (btnOpenAdd) btnOpenAdd.addEventListener('click', () => modalAdd.classList.add('active'));
        if (closeAdd) closeAdd.addEventListener('click', () => modalAdd.classList.remove('active'));
        if (cancelAdd) cancelAdd.addEventListener('click', () => modalAdd.classList.remove('active'));

        // Handle form submit
        const formAdd = document.getElementById('form-add-transaction');
        if (formAdd) {
            formAdd.addEventListener('submit', async (e) => {
                e.preventDefault();

                const rawAmount = parseFloat(document.getElementById('add-transaction-amount').value);
                const transType = document.getElementById('add-transaction-type') ? document.getElementById('add-transaction-type').value : 'in';
                const dateStr = document.getElementById('add-transaction-date').value;
                const description = document.getElementById('add-transaction-description').value;

                if (isNaN(rawAmount) || rawAmount <= 0) {
                    if (typeof Toast !== 'undefined') Toast.show('Valor inválido. Informe um valor maior que zero.', 'warning');
                    return;
                }

                const amount = transType === 'out' ? -Math.abs(rawAmount) : Math.abs(rawAmount);

                // Valida se o saldo ficaria negativo para saídas manuais
                if (transType === 'out') {
                    const currentBalance = Transactions.transactionsList.reduce((sum, t) => sum + parseFloat(t.amount), 0);
                    const balanceAfter = currentBalance + amount; // amount já é negativo
                    if (balanceAfter < 0) {
                        if (typeof Toast !== 'undefined') Toast.show(
                            `Saldo insuficiente! Saldo atual: ${currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Esta saída deixaria a conta negativa.`,
                            'error'
                        );
                        return;
                    }
                }

                // Get current user name
                const currentUser = Auth.getCurrentUser();
                const userName = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';

                const btnSubmit = formAdd.querySelector('button[type="submit"]');
                const origText = btnSubmit.textContent;
                btnSubmit.textContent = 'Salvando...';
                btnSubmit.disabled = true;

                const { data, error } = await AppSupabase
                    .from('transactions')
                    .insert([
                        { amount, date: dateStr, description, user_name: userName, trans_type: transType }
                    ])
                    .select();

                btnSubmit.textContent = origText;
                btnSubmit.disabled = false;

                if (error) {
                    console.error("Erro ao salvar transação:", error);
                    if (typeof Toast !== 'undefined') Toast.show('Erro ao salvar transação no banco.', 'error');
                } else {
                    if (typeof Toast !== 'undefined') Toast.show('Transação salva com sucesso!', 'success');
                    modalAdd.classList.remove('active');
                    formAdd.reset();
                    await Transactions.loadTransactions();
                }
            });
        }
    },

    loadTransactions: async () => {
        const { data, error } = await AppSupabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Erro ao carregar transações:", error);
            if (typeof Toast !== 'undefined') Toast.show('Erro ao carregar histórico de transações.', 'error');
            return;
        }

        Transactions.transactionsList = data || [];
        Transactions.renderDashboard();
        Transactions.renderTransactions();
    },

    filterByPeriod: (list) => {
        const periodSelect = document.getElementById('transactions-period-select');
        if (!periodSelect) return list;
        const period = periodSelect.value;

        if (period === 'all') return list;

        const now = new Date();
        // Consider current timezone manually to avoid offset issues
        now.setHours(0, 0, 0, 0);

        return list.filter(t => {
            const parts = t.date.split('-');
            const tDate = new Date(parts[0], parts[1] - 1, parts[2]); // YYYY-MM-DD

            if (period === '30days') {
                const diffTime = Math.abs(now - tDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 30;
            }
            if (period === 'thismonth') {
                return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
            }
            return true;
        });
    },

    renderDashboard: () => {
        const filtered = Transactions.filterByPeriod(Transactions.transactionsList);
        const allTransactions = Transactions.transactionsList; // Saldo real usa TODAS as transações

        let totalIn = 0;
        let totalOut = 0;
        let totalInvest = 0;

        // Entradas/Saídas do período selecionado
        filtered.forEach(t => {
            if (t.trans_type === 'invest') {
                totalInvest += parseFloat(t.amount);
            } else if (t.amount > 0) {
                totalIn += parseFloat(t.amount);
            }
            if (t.amount < 0) {
                totalOut += parseFloat(t.amount);
            }
        });

        const faturamento = totalIn;

        // Saldo real da conta: soma acumulativa de TODAS as transações (histórico completo)
        // O saldo é sempre acumulativo - não pode ser filtrado por período
        const saldoReal = allTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Saldo do investimento baseado no período
        const investReal = totalInvest + totalOut;

        const formatBRL = (val) => Math.abs(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        document.getElementById('stat-trans-in').textContent = formatBRL(totalIn);
        document.getElementById('stat-trans-out').textContent = formatBRL(totalOut);
        document.getElementById('stat-trans-revenue').textContent = formatBRL(faturamento);

        const elProfit = document.getElementById('stat-trans-profit');
        if (elProfit) {
            elProfit.textContent = (saldoReal < 0 ? '-' : '') + formatBRL(saldoReal);
            if (saldoReal < 0) {
                elProfit.parentElement.previousElementSibling.style.color = "var(--danger)";
                elProfit.style.color = "var(--danger)";
                // Aviso de saldo negativo existente no banco
                if (typeof Toast !== 'undefined') {
                    const warnKey = 'balance-negative-warned';
                    if (!sessionStorage.getItem(warnKey)) {
                        Toast.show('⚠️ Atenção: O saldo da conta está negativo! Verifique as transações existentes.', 'error');
                        sessionStorage.setItem(warnKey, '1');
                    }
                }
            } else {
                elProfit.parentElement.previousElementSibling.style.color = "var(--primary)";
                elProfit.style.color = "var(--text-main)";
                sessionStorage.removeItem('balance-negative-warned');
            }
        }

        const elInvest = document.getElementById('stat-trans-invest');
        if (elInvest) {
            elInvest.textContent = (investReal < 0 ? '-' : '') + formatBRL(investReal);
            if (investReal < 0) {
                elInvest.parentElement.previousElementSibling.style.color = "var(--danger)";
                elInvest.style.color = "var(--danger)";
            } else {
                elInvest.parentElement.previousElementSibling.style.color = "#8b5cf6";
                elInvest.style.color = "var(--text-main)";
            }
        }

        Transactions.renderChart(filtered);
    },

    renderChart: (filtered) => {
        const ctx = document.getElementById('transactions-chart');
        if (!ctx) return;

        if (Transactions.chartInstance) {
            Transactions.chartInstance.destroy();
        }

        // Filtra transações de investimento para não criar colunas ou datas no gráfico
        const chartList = filtered.filter(t => t.trans_type !== 'invest');

        if (chartList.length === 0) {
            return;
        }

        // Group by Date
        // Sort array by ascending datetime for the chart
        const ascList = [...chartList].sort((a, b) => new Date(a.date) - new Date(b.date));

        const groupedObj = {};
        ascList.forEach(t => {
            let ptDate = t.date;
            if (t.date.includes('-')) {
                const [year, month, day] = t.date.split('-');
                ptDate = `${day}/${month}`; // short format for chart
            }
            if (!groupedObj[ptDate]) groupedObj[ptDate] = { in: 0, out: 0, total: 0 };

            const v = parseFloat(t.amount);
            if (v > 0) groupedObj[ptDate].in += v;
            if (v < 0) groupedObj[ptDate].out += (-v); // make positive for bar

            groupedObj[ptDate].total += v; // raw for line excluding investments to track operational balance
        });

        const labels = Object.keys(groupedObj);
        const dataIn = labels.map(l => groupedObj[l].in);
        const dataOut = labels.map(l => groupedObj[l].out);
        const dataTotal = labels.map(l => groupedObj[l].total);

        Transactions.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Entradas',
                        data: dataIn,
                        backgroundColor: '#10b981', // success
                        borderRadius: 4
                    },
                    {
                        label: 'Saídas',
                        data: dataOut,
                        backgroundColor: '#ef4444', // danger
                        borderRadius: 4
                    },
                    {
                        label: 'Saldo do Dia',
                        data: dataTotal,
                        type: 'line',
                        borderColor: '#3b82f6', // info
                        backgroundColor: '#3b82f6',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: false,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#9ca3af', font: { family: 'Inter' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const val = context.parsed.y !== null ? context.parsed.y : 0;
                                label += val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af',
                            callback: function (value) {
                                return 'R$ ' + value;
                            }
                        },
                        grid: { color: '#2e323e' }
                    },
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    renderTransactions: () => {
        const tbody = document.getElementById('transactions-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const filtered = Transactions.filterByPeriod(Transactions.transactionsList);

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 2rem;">Nenhuma transação no período selecionado.</td></tr>';
            return;
        }

        filtered.forEach(t => {
            const tr = document.createElement('tr');

            // format date safe parsing
            let ptDate = t.date;
            if (t.date && t.date.includes('-')) {
                const [year, month, day] = t.date.split('-');
                ptDate = `${day}/${month}/${year}`;
            }

            const valColor = t.amount < 0 ? 'var(--danger)' : 'var(--success)';
            const formattedAmount = Math.abs(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const deleteAction = t.sale_id
                ? `<button class="btn-icon" style="opacity: 0.3; cursor: not-allowed;" title="Transação gerada por venda (para excluir, cancele a venda na aba Saídas)"><i class='bx bx-trash'></i></button>`
                : `<button class="btn-icon delete" onclick="Transactions.deleteTransaction('${t.id}')" title="Excluir Transação"><i class='bx bx-trash'></i></button>`;

            tr.innerHTML = `
        <td>${ptDate}</td>
        <td>${t.description}</td>
        <td style="color: ${valColor}; font-weight: 600;">${t.amount < 0 ? '-' : ''}${formattedAmount}</td>
        <td><span class="badge" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);"><i class='bx bx-user'></i> ${t.user_name}</span></td>
        <td>${deleteAction}</td>
      `;
            tbody.appendChild(tr);
        });
    },

    deleteTransaction: async (id) => {
        const trans = Transactions.transactionsList.find(tx => tx.id === id);
        if (trans && trans.sale_id) {
            if (typeof Toast !== 'undefined') Toast.show('Esta transação é vinculada a uma venda. Cancele a venda na aba Saídas.', 'warning');
            return;
        }

        if (confirm('Deseja realmente excluir esta transação?')) {
            const { error } = await AppSupabase.from('transactions').delete().eq('id', id);
            if (!error) {
                if (typeof Toast !== 'undefined') Toast.show('Transação excluída.', 'info');
                await Transactions.loadTransactions();
            } else {
                console.error("Erro ao excluir", error);
                if (typeof Toast !== 'undefined') Toast.show('Erro ao excluir.', 'error');
            }
        }
    }
};
