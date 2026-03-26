// Gerenciador central do LocalStorage
const Storage = {
  // Retorna dados ou um valor padrão (se nulo/erro)
  get: (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Erro ao ler ${key} do LocalStorage`, e);
      return defaultValue;
    }
  },
  
  // Salva dados no banco
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Erro ao salvar ${key} no LocalStorage`, e);
      return false;
    }
  },

  // Remove dados do banco
  remove: (key) => {
    localStorage.removeItem(key);
  },

  // Inicializa o ambiente na primeira vez que o App é rodado
  initCoreData: () => {
    // 1. Validar e injetar conta admin padrão se o sistema for virgem
    const users = Storage.get('nexus_users', null);
    if (!users || users.length === 0) {
      const defaultUsers = [{
        id: 'usr_admin_' + Date.now(),
        username: 'Justino',
        password: '1145Biel', // Simplificado. Em prod, sempre gere hash da senha!
        name: 'Administrador Principal',
        role: 'admin', // Pode ser 'admin' ou 'operator'
        createdAt: new Date().toISOString()
      }];
      Storage.set('nexus_users', defaultUsers);
      console.log('Setup Inicial: Usuário administrador principal criado com sucesso!');
    }

    // 2. Inicializar arrays de estoque se não existirem
    if (!Storage.get('nexus_inventory')) {
      Storage.set('nexus_inventory', []);
    }

    // 3. Inicializar histório de vendas se não existir
    if (!Storage.get('nexus_sales')) {
      Storage.set('nexus_sales', []);
    }
  }
};
