import { criarApp } from './app';
import { iniciarAgendador } from './lib/agendador';

const porta = Number(process.env.PORT ?? 3000);

// Depois de criar o app: as rotas (e as tarefas agendadas por elas) já estão registradas.
const app = criarApp();
iniciarAgendador();

app.listen(porta, () => {
  console.log(`Servidor rodando na porta ${porta}`);
});
