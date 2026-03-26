// Interface do Painel Administrativo
const Admin = {
  users: [],

  init: () => {
    if (!Auth.isAdmin()) return;

    Admin.loadUsers();
    Admin.renderStats();
    Admin.renderUsers();
    Admin.setupEventListeners();
  },

  loadUsers: () => {
    Admin.users = Storage.get('nexus_users', []);
  },

  deleteUser: (id) => {
    const user = Admin.users.find(u => u.id === id);
    if (!user) return;
    if (user.username === 'Justino' || user.username === 'admin') {
      Toast.show('O administrador principal não pode ser excluído!', 'error');
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o usuário "${user.name}" definitivamente?`)) {
      Admin.users = Admin.users.filter(u => u.id !== id);
      Storage.set('nexus_users', Admin.users);
      Admin.renderUsers();
      Admin.renderStats();
      Toast.show('Usuário excluído com sucesso.', 'info');
    }
  },

  renderStats: () => {
    // Calculo de Meticas a partir do LocalStorage
    const inventory = Storage.get('nexus_inventory', []);
    const totalProducts = inventory.length; // Quantidade de itens/variáveis unicas

    const sales = Storage.get('nexus_sales', []);
    const totalSales = sales.length; // Quantas operacoes de venda
    const totalItemsSold = sales.reduce((sum, sale) => sum + parseInt(sale.qtdSold), 0);

    // UI Update
    if (document.getElementById('stat-total-products')) {
      document.getElementById('stat-total-products').textContent = totalProducts;
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

      newForm.addEventListener('submit', (e) => {
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

        const newUser = {
          id: 'usr_' + Date.now(),
          username,
          password,
          name,
          role,
          createdAt: new Date().toISOString()
        };

        Admin.users.push(newUser);
        Storage.set('nexus_users', Admin.users); // Persiste novo usuário no core

        Toast.show('Acesso concedido e perfil criado!', 'success');
        newForm.reset();

        Admin.renderUsers();
        Admin.renderStats();
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Listeners para toda aba que seja ativada
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.getAttribute('data-target') === 'dashboard-view') {
        Admin.init(); // Recarrega gráficos/dados ao clicar
      }
    });
  });
});
