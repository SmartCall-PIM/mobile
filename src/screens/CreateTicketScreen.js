import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { ticketService, authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Função para converter data UTC do backend para horário local brasileiro
const formatarDataHoraBrasileira = (dataString) => {
  // Se a data não termina com 'Z', adiciona para indicar UTC
  const dataUTC = dataString.endsWith('Z') ? dataString : dataString + 'Z';
  const data = new Date(dataUTC);
  
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function CreateTicketScreen({ navigation }) {
  const [titulo, setTitulo] = useState('');
  const [loading, setLoading] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    loadMyTickets();
  }, []);

  const loadMyTickets = async () => {
    try {
      console.log('📋 Carregando meus chamados...');
      const tickets = await ticketService.getMyTickets();
      console.log('✅ Chamados recebidos:', tickets);
      setMyTickets(tickets);
    } catch (error) {
      console.error('❌ Erro ao carregar chamados:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyTickets();
    setRefreshing(false);
  };

  const handleCreateTicket = async () => {
    if (!titulo.trim()) {
      Alert.alert('Erro', 'Por favor, descreva o problema do chamado');
      return;
    }

    if (titulo.trim().length < 10) {
      Alert.alert('Erro', 'A descrição deve ter no mínimo 10 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await ticketService.create(titulo.trim());
      
      console.log('✅ Chamado criado, navegando para chat:', response);
      
      // Limpa o campo
      setTitulo('');
      
      // Navega para o chat
      navigation.navigate('Chat', { 
        chamadoId: response.Id 
      });
      
      // Recarrega a lista de chamados
      loadMyTickets();
    } catch (error) {
      console.error('Create ticket error:', error);
      const errorMessage = error.Message || 
                          error.Errors?.[0] ||
                          error.message ||
                          'Erro ao criar chamado. Tente novamente.';
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da aplicação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            await signOut();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    // Status pode ser string ou número
    const statusMap = {
      'Pendente': '#ffc107',
      'Em Andamento': '#17a2b8',
      'Resolvido': '#28a745',
      'Escalado': '#dc3545',
      0: '#ffc107',
      1: '#17a2b8',
      2: '#28a745',
      3: '#dc3545',
    };
    return statusMap[status] || '#6c757d';
  };

  const getStatusText = (status) => {
    // Se já é string, retorna direto
    if (typeof status === 'string') return status;
    
    // Se é número, mapeia
    const statusMap = {
      0: 'Pendente',
      1: 'Em Andamento',
      2: 'Resolvido',
      3: 'Escalado',
    };
    return statusMap[status] || 'Desconhecido';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Info */}
        <View style={styles.userInfo}>
          <View>
            <Text style={styles.welcomeText}>Olá, {user?.fullName || user?.email}!</Text>
            <Text style={styles.emailText}>{user?.email}</Text>
            {user?.role && (
              <Text style={styles.roleText}>Perfil: {user.role}</Text>
            )}
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Create Ticket Form */}
        <View style={styles.form}>
          
          <Text style={styles.label}>Descreva o seu problema</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ex: Bilhetagem não funciona, erro no sistema, etc..."
            value={titulo}
            onChangeText={setTitulo}
            multiline
            numberOfLines={4}
            editable={!loading}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreateTicket}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>  Criando chamado...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Criar Chamado</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* My Tickets */}
        <View style={styles.ticketsSection}>
          <Text style={styles.sectionTitle}>Meus Chamados</Text>
          
          {myTickets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Você ainda não possui chamados
              </Text>
            </View>
          ) : (
            myTickets.map((ticket) => (
              <TouchableOpacity 
                key={ticket.Id || ticket.id} 
                style={styles.ticketCard}
                onPress={() => navigation.navigate('Chat', { chamadoId: ticket.Id || ticket.id })}
              >
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketId}>#{ticket.Id || ticket.id}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(ticket.Status || ticket.status) }
                  ]}>
                    <Text style={styles.statusText}>
                      {getStatusText(ticket.Status || ticket.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ticketTitle} numberOfLines={2}>
                  {ticket.Titulo || ticket.titulo}
                </Text>
                <Text style={styles.ticketDate}>
                  {formatarDataHoraBrasileira(ticket.CriadoEm || ticket.dataCriacao)}
                </Text>
                {(ticket.TecnicoNome || ticket.tecnicoNome) && (
                  <Text style={styles.technicianName}>
                    Técnico: {ticket.TecnicoNome || ticket.tecnicoNome}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  userInfo: {
    backgroundColor: '#254396ff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  emailText: {
    fontSize: 14,
    color: '#e0e0e0',
    marginTop: 2,
  },
  roleText: {
    fontSize: 12,
    color: '#c0e0ff',
    marginTop: 2,
    fontStyle: 'italic',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    minHeight: 100,
  },
  button: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ticketsSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  ticketCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#254396ff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  ticketDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  technicianName: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
    fontStyle: 'italic',
  },
});
