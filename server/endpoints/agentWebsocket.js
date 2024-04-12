const { AgentHandler } = require("../utils/agents");
const {
  WEBSOCKET_BAIL_COMMANDS,
} = require("../utils/agents/abitat/plugins/websocket");
const { safeJsonParse } = require("../utils/http");

// Setup listener for incoming messages to relay to socket so it can be handled by agent plugin.
function relayToSocket(message) {
  if (this.handleFeedback) return this?.handleFeedback?.(message);
  this.checkBailCommand(message);
}

function agentWebsocket(app) {
  if (!app) return;

  app.ws("/agent-invocation/:uuid", async function (socket, request) {
    try {
      const agentHandler = await new AgentHandler({
        uuid: String(request.params.uuid),
      }).init();

      if (!agentHandler.invocation) {
        socket.close();
        return;
      }

      socket.on("message", relayToSocket);
      socket.on("close", () => {
        agentHandler.closeAlert();
        return;
      });

      socket.checkBailCommand = (data) => {
        const content = safeJsonParse(data)?.feedback;
        if (WEBSOCKET_BAIL_COMMANDS.includes(content)) {
          agentHandler.log(
            `User invoked bail command while processing. Closing session now.`
          );
          socket.close();
          return;
        }
      };

      await agentHandler.createAbitat({ socket });
      await agentHandler.startAgentCluster();
    } catch (e) {
      console.error(e);
      socket?.send(JSON.stringify({ type: "wssFailure", content: e.message }));
      socket?.close();
    }
  });
}

module.exports = { agentWebsocket };
