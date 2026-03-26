// Interface do Painel Administrativo
const Admin = {
  users: [],

  init: async () => {
    if (!Auth.isAdmin()) return;

    await Admin.loadUsers();
    await Admin.renderStats();
    Admin.renderUsers();
    Admin.setupEventListeners();
  },

  loadUsers: async () => {
    const { data, error } = await AppSupabase.from('profiles').select('*').order('username');
    if (!error && data) {
      Admin.users = data;
    }
  },

  deleteUser: async (id) => {
    const user = Admin.users.find(u => u.id === id);
    if (!user) return;
    if (user.username === 'Justino' || user.username === 'admin') {
      Toast.show('O administrador principal não pode ser excluído!', 'error');
      return;
    }
    if (confirm(`Tem certeza que deseja desativar o usuário "${user.name}"?`)) {
      const { error } = await AppSupabase.from('profiles').delete().eq('id', id);
      if (!error) {
        await Admin.loadUsers();
        Admin.renderUsers();
        await Admin.renderStats();
        Toast.show('Perfil removido com sucesso.', 'info');
      } else {
        Toast.show('Erro ao excluir usuário.', 'error');
      }
    }
  },

  renderStats: async () => {
    // Calculo de Meticas a partir do Supabase
    const { count: inventoryCount } = await AppSupabase.from('inventory').select('*', { count: 'exact', head: true });

    const { data: salesData } = await AppSupabase.from('sales').select('qtd_sold');
    const totalSales = salesData ? salesData.length : 0;
    const totalItemsSold = salesData ? salesData.reduce((sum, sale) => sum + parseInt(sale.qtd_sold), 0) : 0;

    // UI Update
    if (document.getElementById('stat-total-products')) {
      document.getElementById('stat-total-products').textContent = inventoryCount || 0;
      document.getElementById('stat-total-sales').textContent = totalSales;
      document.getElementById('stat-total-items-sold').textContent = totalItemsSold;
      document.getElementById('stat-total-users').textContent = Admin.users.length;
    }
  },

  renderUsers: () => {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    Admin.users.forEach(u => {
      const tr = document.createElement('tr');
      // Cores para identificar o nível visualmente
      const badgeClass = u.role === 'admin' ? 'tag qtd' : 'tag btn-secondary';
      const roleText = u.role === 'admin' ? 'Admin. Global' : 'Operador';

      tr.innerHTML = `
        <td style="font-weight: 500;">${u.name}</td>
        <td style="color: var(--text-muted)"><i class='bx bx-user' style="font-size:0.8rem"></i> ${u.username}</td>
        <td><span class="${badgeClass}">${roleText}</span></td>
        <td>
          <button class="btn-icon delete" onclick="Admin.deleteUser('${u.id}')" ${u.username === 'Justino' ? 'disabled style="opacity:0.3; cursor:not-allowed;" title="Admin principal não pode ser deletado"' : 'title="Excluir Usuário"'}><i class='bx bx-trash'></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  setupEventListeners: () => {
    const form = document.getElementById('form-create-user');
    if (form) {
      // Remover os antigos caso Admin seja re-init via Menu
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('new-user-name').value;
        const username = document.getElementById('new-user-username').value;
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        // Checar conflito de username
        const exists = Admin.users.find(u => u.username === username);
        if (exists) {
          Toast.show('O nome de usuário (Login) já está ativo no sistema.', 'error');
          return;
        }

        Toast.show('Criando perfil na nuvem...', 'info');

        // Isolated client para signup sem deslogar o admin atual
        const adminSignupClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        const email = username.includes('@') ? username : `${username}@golrila.com`;

        const { data, error } = await adminSignupClient.auth.signUp({
          email,
          password,
          options: {
            data: { username, name, role }
          }
        });

        if (error) {
          console.error(error);
          Toast.show('Falha ao registrar usuário: ' + error.message, 'error');
          return;
        }

        Toast.show('Acesso concedido e perfil criado!', 'success');
        newForm.reset();

        await Admin.loadUsers();
        Admin.renderUsers();
        await Admin.renderStats();
      });
    }
  }
};

// Navigation initialization moved to app.js
