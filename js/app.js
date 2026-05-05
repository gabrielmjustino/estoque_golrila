// Controlador principal da interface e Inicializador global

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verifica autenticacao (Supabase)
  // Login view já está visível via CSS por padrão
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  // Mostra indicador de carregamento enquanto verifica sessão
  const loginCard = loginView.querySelector('.login-card');
  const loadingMsg = document.createElement('p');
  loadingMsg.id = 'auth-checking-msg';
  loadingMsg.style.cssText = 'color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;';
  loadingMsg.textContent = 'Verificando sessão...';
  loginCard.appendChild(loadingMsg);

  const isLoggedIn = await Auth.init();
  loadingMsg.remove();

  if (isLoggedIn) {
    loginView.classList.add('hidden');
    showApp();
  }
  // Se não estiver logado, login-view já está visível naturalmente

  // 3. Lidar com envio do form de login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('login-username').value;
      const pass = document.getElementById('login-password').value;

      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Entrando...';

      const success = await Auth.login(user, pass);
      btn.disabled = false;
      btn.textContent = 'Entrar no Sistema';

      if (success) {
        Toast.show('Autenticação aprovada! Entrando...', 'success');

        // Pequeno delay para efeito visual premium
        setTimeout(() => {
          loginView.classList.add('hidden');
          showApp();
        }, 800);
      } else {
        Toast.show('Usuário ou senha incorretos. Acesso negado.', 'error');
      }
    });
  }

  // 4. Lidar com Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      await Auth.logout();
    });
  }

  const btnLogoutSettings = document.getElementById('btn-logout-settings');
  if (btnLogoutSettings) {
    btnLogoutSettings.addEventListener('click', async (e) => {
      e.preventDefault();
      await Auth.logout();
    });
  }

  // 4.5. Lidar com Mudança de Senha
  const formChangePassword = document.getElementById('form-change-password');
  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('new-password-input').value;
      const confirmPass = document.getElementById('confirm-password-input').value;

      if (newPass !== confirmPass) {
        Toast.show('As senhas não coincidem. Tente novamente.', 'error');
        return;
      }

      const { error } = await AppSupabase.auth.updateUser({ password: newPass });

      if (!error) {
        Toast.show('Senha atualizada com sucesso!', 'success');
        formChangePassword.reset();
      } else {
        Toast.show('Erro ao atualizar senha no banco de dados.', 'error');
      }
    });
  }

  // 5. Setup do Router (Menu lateral)
  const navItems = document.querySelectorAll('.nav-links .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      const targetId = item.getAttribute('data-target');
      if (targetId) {
        // Atualiza Nav Visual
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // Atualiza View do Container Main
        document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        // Atualiza Titulo da Pagina Header
        document.getElementById('page-title').textContent = item.textContent.trim();

        // Refresh Data Context whenever a tab is clicked
        if (targetId === 'transactions-view' && typeof Transactions !== 'undefined') Transactions.loadTransactions();
        if (targetId === 'inventory-view' && typeof Inventory !== 'undefined') {
          Inventory.load().then(() => Inventory.render());
        }
        if (targetId === 'sold-view' && typeof Sales !== 'undefined') {
          Sales.load().then(() => Sales.render());
        }
      }
    });
  });

  // ========== SUPABASE REALTIME SYNC ==========
  try {
    AppSupabase.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: '*' }, (payload) => {
        if (payload.table === 'transactions' && typeof Transactions !== 'undefined') {
          Transactions.loadTransactions();
        }
        if (payload.table === 'inventory' && typeof Inventory !== 'undefined') {
          Inventory.load().then(() => Inventory.render());
        }
        if (payload.table === 'sales' && typeof Sales !== 'undefined') {
          Sales.load().then(() => Sales.render());
        }
      })
      .subscribe();
  } catch (err) {
    console.error("Realtime sync setup problem", err);
  }

  // Funcao Privada para liberar visao ao App principal
  async function showApp() {
    appView.classList.add('active');

    // Configura o UI com os dados do usuário autenticado
    const user = Auth.getCurrentUser();
    document.getElementById('current-user-name').textContent = user.name || user.username;

    const roleBadge = document.getElementById('current-user-role');

    // Perfilamentos Visuais e Restrições Básicas no Layout
    if (user.role === 'admin') {
      roleBadge.textContent = 'Admin. Global☁️';
      roleBadge.style.background = 'rgba(99, 102, 241, 0.15)';
      roleBadge.style.color = '#FCBF00';

      // Exibe menu do dashboard do admin
      document.getElementById('nav-dashboard').style.display = 'flex';
    } else {
      roleBadge.textContent = 'Operador Padrão☁️';
      roleBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      roleBadge.style.color = '#34d399';

      // Remove abas de transações e saídas
      const navSold = document.getElementById('nav-sold');
      const navTransactions = document.getElementById('nav-transactions');
      if (navSold) navSold.parentElement.style.display = 'none';
      if (navTransactions) navTransactions.parentElement.style.display = 'none';
    }

    // Inicializa Módulos em paralelo (Inventory + Sales ao mesmo tempo)
    const initTasks = [];
    if (typeof Inventory !== 'undefined') initTasks.push(Inventory.init());
    if (typeof Sales !== 'undefined') initTasks.push(Sales.init());
    if (typeof Transactions !== 'undefined') initTasks.push(Transactions.init());
    await Promise.all(initTasks);

    // Admin depende dos dados já carregados
    if (user.role === 'admin' && typeof Admin !== 'undefined') await Admin.init();
  }
});

// Sistema de Notificações estilo "Toasts" (Avisos de Cantinho)
const Toast = {
  show: (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Seleciona ícone e cores adequadas
    let icon = 'bx-info-circle';
    if (type === 'success') icon = 'bx-check-circle';
    if (type === 'error') icon = 'bx-x-circle';
    if (type === 'warning') icon = 'bx-error';

    toast.innerHTML = `<i class='bx ${icon}'></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Timeout de visualização de 3.5 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400); // Remove totalmente o nodo
    }, 3500);
  }
};
