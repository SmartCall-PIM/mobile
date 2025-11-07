import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Para Android emulator use: http://10.0.2.2:8000
// Para iOS simulator use: http://localhost:8000
// Para dispositivo físico use o IP da sua máquina: http://192.168.x.x:8000
const API_BASE_URL = 'http://192.168.1.64:8000/api';

console.log('🌐 API Base URL configurada:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos de timeout (criar chamado pode demorar por causa da IA)
});

// Interceptor para adicionar token JWT em todas as requisições
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token inválido ou expirado
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email, password) => {
    try {
      console.log('📡 authService.login chamado');
      console.log('📧 Email:', email);
      console.log('🔗 URL completa:', `${API_BASE_URL}/auth/login`);
      
      const payload = { 
        Email: email, 
        Password: password 
      };
      console.log('📦 Payload:', JSON.stringify(payload));
      
      const response = await api.post('/auth/login', payload);
      console.log('✅ Resposta recebida:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro no authService.login:', error);
      console.error('❌ Erro código:', error.code);
      console.error('❌ Erro mensagem:', error.message);
      console.error('❌ Erro response:', error.response?.data);
      throw error.response?.data || error;
    }
  },
  
  register: async (email, password, confirmPassword, fullName = '') => {
    try {
      const response = await api.post('/auth/register', { 
        Email: email, 
        Password: password,
        ConfirmPassword: confirmPassword,
        FullName: fullName
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao registrar:', error);
      throw error.response?.data || error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
  },
};

export const ticketService = {
  create: async (titulo) => {
    try {
      console.log('🎫 Criando chamado...');
      const payload = { 
        MensagemInicial: titulo 
      };
      console.log('📦 Payload:', JSON.stringify(payload));
      
      const response = await api.post('/chamados', payload);
      console.log('✅ Chamado criado:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao criar chamado:', error);
      console.error('❌ Erro response:', error.response?.data);
      throw error.response?.data || error;
    }
  },
  
  getMyTickets: async () => {
    const response = await api.get('/chamados');
    return response.data;
  },
  
  getTicketById: async (id) => {
    const response = await api.get(`/chamados/${id}`);
    return response.data;
  },
};

export const chatService = {
  getChamado: async (chamadoId) => {
    try {
      const response = await api.get(`/chamados/${chamadoId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar chamado:', error);
      throw error.response?.data || error;
    }
  },

  getNovasMensagens: async (chamadoId, afterId = 0) => {
    try {
      const response = await api.get(`/chamados/${chamadoId}/mensagens/novas?afterId=${afterId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar novas mensagens:', error);
      throw error.response?.data || error;
    }
  },

  sendMessage: async (chamadoId, mensagem) => {
    try {
      const response = await api.post(`/chamados/${chamadoId}/mensagens`, {
        Message: mensagem
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      throw error.response?.data || error;
    }
  },
};

export default api;
