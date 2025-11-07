import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';
import api, { chatService } from '../services/api';

// Função para converter data UTC do backend para horário local
const formatarHoraBrasileira = (dataString) => {
  // Se a data não termina com 'Z', adiciona para indicar UTC
  const dataUTC = dataString.endsWith('Z') ? dataString : dataString + 'Z';
  const data = new Date(dataUTC);
  
  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Componente de indicador de digitação animado
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -10,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={styles.typingIndicatorContainer}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
        </View>
      </View>
    </View>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { chamadoId } = route.params;
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [iaDigitando, setIaDigitando] = useState(false);
  const [chamado, setChamado] = useState(null);
  const flatListRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const lastMessageIdRef = useRef(0);

  useEffect(() => {
    loadChamado();
  }, [chamadoId]);

  // Polling separado que não depende de mensagens
  useEffect(() => {
    // Inicia polling após 2 segundos
    const timeoutId = setTimeout(() => {
      pollIntervalRef.current = setInterval(() => {
        checkNovasMensagens();
      }, 2000);
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [chamadoId]);

  // Função para scroll suave
  const scrollToEnd = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const loadChamado = async () => {
    try {
      console.log('📋 Carregando chamado:', chamadoId);
      const data = await chatService.getChamado(chamadoId);
      console.log('✅ Chamado recebido:', data);
      
      setChamado(data);
      
      if (data.Mensagens && data.Mensagens.length > 0) {
        const mensagensFormatadas = data.Mensagens.map(m => ({
          id: m.Id,
          text: m.Message,
          isUser: m.IsUser,
          senderType: m.SenderType,
          createdAt: m.CreatedAt,
        }));
        
        setMensagens(mensagensFormatadas);
        
        // Atualiza o último ID de mensagem
        const maxId = Math.max(...mensagensFormatadas.map(m => m.id));
        lastMessageIdRef.current = maxId;
        console.log('📊 Último ID de mensagem:', maxId);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar chamado:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkNovasMensagens = async () => {
    // Verifica novas mensagens
    try {
      const lastMessageId = lastMessageIdRef.current;

      const novasMensagens = await chatService.getNovasMensagens(chamadoId, lastMessageId);
      
      if (novasMensagens && novasMensagens.length > 0) {
        console.log('📬 Novas mensagens recebidas:', novasMensagens.length);
        
        const mensagensFormatadas = novasMensagens.map(m => ({
          id: m.Id,
          text: m.Message,
          isUser: m.IsUser,
          senderType: m.SenderType,
          createdAt: m.CreatedAt,
        }));
        
        // Filtra apenas mensagens que ainda não existem
        setMensagens(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const novasMensagensFiltradas = mensagensFormatadas.filter(m => !existingIds.has(m.id));
          
          if (novasMensagensFiltradas.length > 0) {
            console.log('➕ Adicionando', novasMensagensFiltradas.length, 'mensagens novas');
            return [...prev, ...novasMensagensFiltradas];
          }
          return prev;
        });
        
        // Atualiza o último ID
        const maxId = Math.max(...mensagensFormatadas.map(m => m.id));
        if (maxId > lastMessageIdRef.current) {
          lastMessageIdRef.current = maxId;
          console.log('📊 Novo último ID de mensagem:', maxId);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar novas mensagens:', error);
    }
    
    // Sempre verifica mudança no status do chamado (separado para não depender das mensagens)
    try {
      const chamadoAtualizado = await chatService.getChamado(chamadoId);
      if (chamadoAtualizado && chamado) {
        // Verifica mudança de status
        if (chamadoAtualizado.Status !== chamado.Status) {
          console.log('🔄 Status do chamado alterado:', chamado.Status, '→', chamadoAtualizado.Status);
          setChamado(chamadoAtualizado);
        }
        // Verifica se foi atribuído a técnico
        else if (chamadoAtualizado.AtribuidoATecnico !== chamado.AtribuidoATecnico) {
          console.log('👨‍💻 Chamado atribuído a técnico:', chamadoAtualizado.AtribuidoATecnico);
          setChamado(chamadoAtualizado);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status do chamado:', error);
    }
  };

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim()) return;

    // Fecha o teclado
    Keyboard.dismiss();

    // Verifica o status atual do chamado antes de enviar
    try {
      const chamadoAtual = await chatService.getChamado(chamadoId);
      if (chamadoAtual.Status === 'Resolvido') {
        Alert.alert(
          'Chamado Resolvido',
          'Este chamado já foi marcado como resolvido e não aceita mais mensagens.',
          [{ text: 'OK' }]
        );
        setNovaMensagem('');
        setChamado(chamadoAtual); // Atualiza o estado local
        return;
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status do chamado:', error);
    }

    const mensagemTexto = novaMensagem.trim();
    setNovaMensagem('');

    // Cria mensagem temporária do usuário com ID negativo (será substituída pela real)
    const tempUserMessage = {
      id: -Date.now(), // ID temporário negativo
      text: mensagemTexto,
      isUser: true,
      senderType: 'user',
      createdAt: new Date().toISOString(),
    };

    // Adiciona mensagem do usuário imediatamente
    setMensagens(prev => [...prev, tempUserMessage]);
    setEnviando(true);
    setIaDigitando(true);

    try {
      console.log('📤 Enviando mensagem...');
      const response = await chatService.sendMessage(chamadoId, mensagemTexto);
      console.log('✅ Mensagem enviada:', response);

      // Remove a mensagem temporária e adiciona as mensagens reais
      setMensagens(prev => {
        const semTemp = prev.filter(m => m.id !== tempUserMessage.id);
        const novasMensagens = [];
        
        if (response.UserMessage) {
          novasMensagens.push({
            id: response.UserMessage.Id,
            text: response.UserMessage.Message,
            isUser: true,
            senderType: response.UserMessage.SenderType || 'user',
            createdAt: response.UserMessage.CreatedAt,
          });
        }

        if (response.BotMessage) {
          novasMensagens.push({
            id: response.BotMessage.Id,
            text: response.BotMessage.Message,
            isUser: false,
            senderType: response.BotMessage.SenderType || 'ai',
            createdAt: response.BotMessage.CreatedAt,
          });
        }

        // Filtra duplicatas
        const existingIds = new Set(semTemp.map(m => m.id));
        const mensagensFiltradas = novasMensagens.filter(m => !existingIds.has(m.id));
        
        return [...semTemp, ...mensagensFiltradas];
      });

      // Atualiza o último ID
      if (response.BotMessage) {
        const maxId = Math.max(
          response.UserMessage?.Id || 0,
          response.BotMessage.Id
        );
        lastMessageIdRef.current = Math.max(lastMessageIdRef.current, maxId);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      // Verifica se o erro é por chamado resolvido
      const errorMessage = error.response?.data?.error || error.message || '';
      if (errorMessage.toLowerCase().includes('resolvido') || errorMessage.toLowerCase().includes('bloqueado')) {
        Alert.alert(
          'Chamado Resolvido',
          'Este chamado já foi marcado como resolvido e não aceita mais mensagens.',
          [{ text: 'OK' }]
        );
        
        // Atualiza o status do chamado
        try {
          const chamadoAtual = await chatService.getChamado(chamadoId);
          setChamado(chamadoAtual);
        } catch (err) {
          console.error('Erro ao atualizar chamado:', err);
        }
      } else {
        Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tente novamente.');
      }
      
      // Remove a mensagem temporária em caso de erro
      setMensagens(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setEnviando(false);
      setIaDigitando(false);
    }
  };

  const handleResolverChamado = (resolvido) => {
    if (resolvido) {
      // Mostra confirmação antes de marcar como resolvido
      Alert.alert(
        'Confirmar Resolução',
        'Tem certeza que seu problema foi resolvido? Esta ação encerrará o chamado.',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Sim, Resolver',
            style: 'default',
            onPress: async () => {
              try {
                // Marca como resolvido no backend usando PATCH
                await api.patch(`/chamados/${chamadoId}/status`, JSON.stringify('Resolvido'), {
                  headers: { 'Content-Type': 'application/json' }
                });
                
                // Atualiza o estado local
                setChamado(prev => ({ ...prev, Status: 'Resolvido' }));
                
                Alert.alert(
                  'Sucesso!',
                  'Chamado marcado como resolvido. Obrigado por usar nosso serviço!'
                );
                
                // Recarrega para garantir sincronização
                const data = await chatService.getChamado(chamadoId);
                setChamado(data);
              } catch (error) {
                console.error('❌ Erro ao resolver chamado:', error);
                Alert.alert('Erro', 'Não foi possível marcar o chamado como resolvido. Tente novamente.');
              }
            }
          }
        ]
      );
    } else {
      // Mostra confirmação antes de escalonar
      Alert.alert(
        'Chamar um Técnico?',
        'Deseja que um técnico especializado entre em contato para ajudar?',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Sim, Chamar',
            style: 'default',
            onPress: async () => {
              try {
                console.log('🔧 Escalando chamado', chamadoId);
                // Escala para técnico usando a API
                const response = await api.post(`/chamados/${chamadoId}/escalar`);
                console.log('✅ Resposta do escalonamento:', response.data);
                
                Alert.alert(
                  'Chamado Encaminhado',
                  '🔧 Seu chamado foi escalado para um técnico especializado que entrará em contato em breve.',
                  [{ text: 'OK' }]
                );
                
                // Recarrega o chamado para atualizar status
                const data = await chatService.getChamado(chamadoId);
                setChamado(data);
                
                if (data.Mensagens && data.Mensagens.length > 0) {
                  const mensagensFormatadas = data.Mensagens.map(m => ({
                    id: m.Id,
                    text: m.Message,
                    isUser: m.IsUser,
                    senderType: m.SenderType,
                    createdAt: m.CreatedAt,
                  }));
                  setMensagens(mensagensFormatadas);
                  
                  const maxId = Math.max(...mensagensFormatadas.map(m => m.id));
                  lastMessageIdRef.current = maxId;
                }
              } catch (error) {
                console.error('❌ Erro ao escalonar chamado:', error);
                Alert.alert('Erro', 'Não foi possível encaminhar o chamado. Tente novamente.');
              }
            }
          }
        ]
      );
    }
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.isUser || item.senderType === 'user';
    const isTecnico = item.senderType === 'tecnico';
    const isAI = item.senderType === 'ai' || (!isUser && !isTecnico);
    
    // Debug para verificar o tipo de mensagem
    console.log('🔍 Mensagem:', item.text.substring(0, 30), 'senderType:', item.senderType, 'isTecnico:', isTecnico);
    
    // Verifica se é a última mensagem da IA e o chamado não está resolvido
    const isLastAIMessage = isAI && index === mensagens.length - 1;
    const showResolverButtons = isLastAIMessage && chamado?.Status !== 'Resolvido';

    return (
      <View>
        <View style={[
          styles.messageContainer,
          (isTecnico || isAI) ? styles.botMessage : styles.userMessage
        ]}>
          {isTecnico ? (
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.messageBubble, styles.tecnicoBubble]}
            >
              {/* Badge de identificação do técnico */}
              <View style={styles.tecnicoBadge}>
                <Text style={styles.tecnicoBadgeText}>TÉCNICO</Text>
              </View>
              
              <Markdown style={tecnicoMarkdownStyles}>
                {item.text}
              </Markdown>
              
              <Text style={[styles.messageTime, styles.messageTimeWhite]}>
                {formatarHoraBrasileira(item.createdAt)}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.botBubble
            ]}>
              {isAI ? (
                <Markdown style={markdownStyles}>
                  {item.text}
                </Markdown>
              ) : (
                <Text style={[
                  styles.messageText,
                  isUser ? styles.userMessageText : styles.botMessageText
                ]}>
                  {item.text}
                </Text>
              )}
              <Text style={[styles.messageTime, isUser && styles.messageTimeWhite]}>
                {formatarHoraBrasileira(item.createdAt)}
              </Text>
            </View>
          )}
        </View>
        
        {/* Botões de resolução após a última mensagem da IA */}
        {showResolverButtons && (
          <View style={styles.resolverContainer}>
            <Text style={styles.resolverPergunta}>Seu problema foi resolvido?</Text>
            <View style={styles.resolverButtons}>
              <TouchableOpacity
                style={[styles.resolverButton, styles.resolverButtonSim]}
                onPress={() => handleResolverChamado(true)}
              >
                <Text style={styles.resolverButtonText}>✓ Sim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resolverButton, styles.resolverButtonNao]}
                onPress={() => handleResolverChamado(false)}
              >
                <Text style={styles.resolverButtonText}>✗ Não</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#254396ff" />
        <Text style={styles.loadingText}>Carregando conversa...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header do Chat */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Chamado #{chamado?.Id}
        </Text>
        <Text style={styles.headerSubtitle}>
          {chamado?.Titulo}
        </Text>
        <View style={[styles.statusBadge, { 
          backgroundColor: chamado?.Status === 'Resolvido' ? '#28a745' : '#17a2b8' 
        }]}>
          <Text style={styles.statusText}>{chamado?.Status}</Text>
        </View>
      </View>

      {/* Lista de Mensagens */}
      <FlatList
        ref={flatListRef}
        data={mensagens}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToEnd}
        onLayout={scrollToEnd}
      />

      {/* Indicador de IA digitando */}
      {iaDigitando && <TypingIndicator />}

      {/* Composer */}
      {chamado?.Status === 'Resolvido' ? (
        <View style={styles.composerDisabled}>
          <Text style={styles.chamadoResolvidoText}>
            ✓ Chamado resolvido - Não é possível enviar novas mensagens
          </Text>
        </View>
      ) : (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Digite sua mensagem..."
            value={novaMensagem}
            onChangeText={setNovaMensagem}
            multiline
            maxLength={500}
            editable={!iaDigitando}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!novaMensagem.trim() || iaDigitando) && styles.sendButtonDisabled]}
            onPress={handleEnviarMensagem}
            disabled={!novaMensagem.trim() || iaDigitando}
          >
            {iaDigitando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>▶</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#254396ff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#0056b3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e0e0',
    marginTop: 5,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  messagesList: {
    padding: 15,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 15,
  },
  userMessage: {
    alignItems: 'flex-start',
  },
  botMessage: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
  },
  userBubble: {
    backgroundColor: '#254396ff',
    borderBottomLeftRadius: 5,
  },
  tecnicoBubble: {
    borderBottomRightRadius: 5,
  },
  tecnicoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  tecnicoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  botBubble: {
    backgroundColor: '#fff',
    borderBottomRightRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  messageTimeWhite: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  typingIndicatorContainer: {
    padding: 10,
    paddingBottom: 5,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: '70%',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginHorizontal: 3,
  },
  resolverContainer: {
    padding: 15,
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  resolverPergunta: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
    fontWeight: '500',
  },
  resolverButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  resolverButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  resolverButtonSim: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  resolverButtonNao: {
    backgroundColor: '#f8d7da',
    borderColor: '#dc3545',
  },
  resolverButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'flex-end',
  },
  composerDisabled: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  chamadoResolvidoText: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#254396ff',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

// Estilos customizados para o Markdown
const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#1a1a1a',
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 6,
    color: '#1a1a1a',
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 4,
    color: '#1a1a1a',
  },
  paragraph: {
    marginVertical: 4,
    lineHeight: 22,
  },
  listItem: {
    marginVertical: 2,
  },
  listUnorderedItemIcon: {
    marginLeft: 10,
    marginRight: 10,
  },
  listOrderedItemIcon: {
    marginLeft: 10,
    marginRight: 10,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  code_inline: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  code_block: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fence: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  blockquote: {
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 4,
    borderLeftColor: '#ccc',
    paddingLeft: 10,
    marginVertical: 5,
    fontStyle: 'italic',
  },
  hr: {
    backgroundColor: '#ddd',
    height: 1,
    marginVertical: 10,
  },
  link: {
    color: '#254396ff',
    textDecorationLine: 'underline',
  },
};

// Estilos de Markdown para mensagens de técnico (texto branco)
const tecnicoMarkdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
    margin: 0,
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 4,
    color: '#fff',
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 3,
    color: '#fff',
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 2,
    color: '#fff',
  },
  paragraph: {
    marginVertical: 0,
    marginBottom: 4,
    lineHeight: 22,
    color: '#fff',
  },
  listItem: {
    marginVertical: 1,
    color: '#fff',
  },
  listUnorderedItemIcon: {
    marginLeft: 10,
    marginRight: 10,
    color: '#fff',
  },
  listOrderedItemIcon: {
    marginLeft: 10,
    marginRight: 10,
    color: '#fff',
  },
  strong: {
    fontWeight: 'bold',
    color: '#fff',
  },
  em: {
    fontStyle: 'italic',
    color: '#fff',
  },
  code_inline: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#fff',
  },
  code_block: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#fff',
  },
  fence: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#fff',
  },
  blockquote: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
    paddingLeft: 10,
    marginVertical: 5,
    fontStyle: 'italic',
    color: '#fff',
  },
  hr: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    height: 1,
    marginVertical: 10,
  },
  link: {
    color: '#fff',
    textDecorationLine: 'underline',
  },
  text: {
    color: '#fff',
  },
};

