// Serviço de Autenticação e Sessão integrando com Supabase
const Auth = {
  currentUser: null,
  currentProfile: null,

  // Verifica se há alguma sessão ativa
  init: async () => {
    const { data: { session } } = await AppSupabase.auth.getSession();
    if (session) {
      Auth.currentUser = session.user;
      await Auth.loadProfile(session.user.id);
      return true;
    }
    return false;
  },

  loadProfile: async (userId) => {
    const { data, error } = await AppSupabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.error('Falha ao carregar profile:', error);
      if (typeof Toast !== 'undefined') Toast.show('Erro Crítico ao carregar Perfil do BD!', 'error');
    }
    if (!error && data) {
      Auth.currentProfile = data;
      console.log('Profile loaded successfully:', data.role);
    }
  },

  // Tenta realizar logon
  login: async (username, password) => {
    const email = username.includes('@') ? username : `${username}@golrila.com`;
    const { data, error } = await AppSupabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Erro de login:', error.message);
      return false;
    }

    Auth.currentUser = data.user;
    await Auth.loadProfile(data.user.id);
    return true;
  },

  // Destrói sessão em cache e recarrega
  logout: async () => {
    await AppSupabase.auth.signOut();
    Auth.currentUser = null;
    Auth.currentProfile = null;
    window.location.reload();
  },

  getCurrentUser: () => {
    if (!Auth.currentUser || !Auth.currentProfile) return null;
    return {
      id: Auth.currentUser.id,
      username: Auth.currentProfile.username,
      name: Auth.currentProfile.name,
      role: Auth.currentProfile.role
    };
  },

  // Checa permissões
  isAdmin: () => {
    return Auth.currentProfile && Auth.currentProfile.role === 'admin';
  }
};
