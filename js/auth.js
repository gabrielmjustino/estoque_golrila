// Serviço de Autenticação e Sessão
const Auth = {
  currentUser: null,

  // Verifica se há alguma sessão ativa persistida no navegador
  init: () => {
    const session = Storage.get('nexus_session');
    if (session) {
      Auth.currentUser = session;
      return true;
    }
    return false;
  },

  // Tenta realizar logon
  login: (username, password) => {
    const users = Storage.get('nexus_users', []);
    
    // Busca usuário.
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      // Remover campo senha antes de salvar a sessão temporária
      const { password: _, ...userSafe } = user;
      
      Storage.set('nexus_session', userSafe);
      Auth.currentUser = userSafe;
      return true;
    }
    return false;
  },

  // Destrói sessão em cache e recarrega
  logout: () => {
    Storage.remove('nexus_session');
    Auth.currentUser = null;
    window.location.reload();
  },

  getCurrentUser: () => {
    return Auth.currentUser;
  },

  // Checa permissões
  isAdmin: () => {
    return Auth.currentUser && Auth.currentUser.role === 'admin';
  }
};
