const Transactions = {
    transactionsList: [],

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

        // Fechar se clicar fora do modal
        window.addEventListener('click', (e) => {
            if (e.target === modalAdd) {
                modalAdd.style.display = 'none';
            }
        });

        if (btnOpenAdd) btnOpenAdd.addEventListener('click', () => modalAdd.style.display = 'flex');
        if (closeAdd) closeAdd.addEventListener('click', () => modalAdd.style.display = 'none');
        if (cancelAdd) cancelAdd.addEventListener('click', () => modalAdd.style.display = 'none');

        // Handle form submit
        const formAdd = document.getElementById('form-add-transaction');
        if (formAdd) {
            formAdd.addEventListener('submit', async (e) => {
                e.preventDefault();

                const amount = parseFloat(document.getElementById('add-transaction-amount').value);
                const dateStr = document.getElementById('add-transaction-date').value;
                const description = document.getElementById('add-transaction-description').value;

                if (isNaN(amount)) {
                    if (typeof Toast !== 'undefined') Toast.show('Valor inválido.', 'warning');
                    return;
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
                        { amount, date: dateStr, description, user_name: userName }
                    ])
                    .select();

                btnSubmit.textContent = origText;
                btnSubmit.disabled = false;

                if (error) {
                    console.error("Erro ao salvar transação:", error);
                    if (typeof Toast !== 'undefined') Toast.show('Erro ao salvar transação no banco.', 'error');
                } else {
                    if (typeof Toast !== 'undefined') Toast.show('Transação salva com sucesso!', 'success');
                    modalAdd.style.display = 'none';
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
        Transactions.renderTransactions();
    },

    renderTransactions: () => {
        const tbody = document.getElementById('transactions-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (Transactions.transactionsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 2rem;">Nenhuma transação registrada.</td></tr>';
            return;
        }

        Transactions.transactionsList.forEach(t => {
            const tr = document.createElement('tr');

            // format date safe parsing
            let ptDate = t.date;
            if (t.date && t.date.includes('-')) {
                const [year, month, day] = t.date.split('-');
                ptDate = `${day}/${month}/${year}`;
            }

            const valColor = t.amount < 0 ? 'var(--danger)' : 'var(--success)';
            const formattedAmount = Math.abs(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            tr.innerHTML = `
        <td>${ptDate}</td>
        <td>${t.description}</td>
        <td style="color: ${valColor}; font-weight: 600;">${t.amount < 0 ? '-' : ''}${formattedAmount}</td>
        <td><span class="badge" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);"><i class='bx bx-user'></i> ${t.user_name}</span></td>
      `;
            tbody.appendChild(tr);
        });
    }
};
