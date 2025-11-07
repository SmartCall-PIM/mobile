# SmartCall Mobile

Aplicativo móvel do sistema SmartCall para abertura e acompanhamento de chamados de suporte técnico.

## 📱 Tecnologias

- **React Native** com Expo
- **React Navigation** para navegação
- **Axios** para requisições HTTP
- **AsyncStorage** para persistência local
- **JWT** para autenticação

## 🚀 Como executar

### Pré-requisitos

- Node.js 18+ instalado
- Backend SmartCall rodando em `http://localhost:8000`
- Expo CLI instalado globalmente: `npm install -g expo-cli`

### Instalação

```bash
cd mobile
npm install
```

### Executar

#### Android (Emulador ou Dispositivo)
```bash
npm run android
```

#### iOS (Apenas macOS)
```bash
npm run ios
```

#### Expo Go (Teste rápido)
```bash
npm start
```
Escaneie o QR Code com o app Expo Go no seu celular.

## 🔧 Configuração

### API Base URL

Edite o arquivo `src/services/api.js` e ajuste a URL base conforme seu ambiente:

```javascript
// Android Emulator
const API_BASE_URL = 'http://10.0.2.2:8000/api';

// iOS Simulator
const API_BASE_URL = 'http://localhost:8000/api';

// Dispositivo físico (use o IP da sua máquina)
const API_BASE_URL = 'http://192.168.1.100:8000/api';
```

## 📄 Licença

Este projeto faz parte do sistema SmartCall.
