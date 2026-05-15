import json
import logging
import os
import textwrap

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    inference,
    room_io,
)
from livekit.plugins import ai_coustics, fishaudio, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env.local")

DATA_TOPIC = "agent-event"


class CollectorAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            llm=inference.LLM(model="openai/gpt-5.2-chat-latest"),
            instructions=textwrap.dedent(
                """\
                You are Alex, a debt collection specialist at Acme Finance.

                Your goal: Get the debtor to commit to a specific payment amount and date.

                Rules:
                - Keep responses short (1-2 sentences max)
                - Ask one question at a time
                - Be professional but firm
                - When the debtor agrees to pay a specific amount on a specific date,
                  call the record_repayment_commitment tool with that amount and date
                - After recording, confirm the commitment and end the call politely

                Always reply in English.
                """
            ),
        )

    @function_tool
    async def record_repayment_commitment(
        self,
        context: RunContext,
        amount: str,
        date: str,
    ) -> str:
        """Record when debtor commits to pay.

        Call this when debtor agrees to BOTH a specific amount AND a specific date.

        Args:
            amount: Payment amount (e.g., "$200", "$850")
            date: Payment date (e.g., "next Friday", "May 20th")
        """
        logger.info(f"Commitment: {amount} on {date}")

        # Send data channel event to frontend
        room = context.session.room
        if room:
            payload = json.dumps({
                "type": "commitment_reached",
                "amount": amount,
                "date": date,
            }).encode("utf-8")
            await room.local_participant.publish_data(
                payload=payload,
                reliable=True,
                topic=DATA_TOPIC,
            )

        return f"Commitment recorded: {amount} on {date}. Confirm this with the debtor and end the call."

server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="agent")
async def my_agent(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Set up a voice AI pipeline using OpenAI, Cartesia, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=inference.STT(model="deepgram/nova-3", language="en"),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # Switched from LiveKit Inference (Cartesia) to Fish Audio per the
        # demo's hard constraint. The plugin reads FISH_API_KEY from the
        # environment. We also read FISH_VOICE_ID from env so the voice can
        # be swapped without a redeploy of the code — just `lk agent
        # update-secrets`. If FISH_VOICE_ID is unset, the plugin's default
        # voice is used.
        # See https://pypi.org/project/livekit-plugins-fishaudio/
        tts=fishaudio.TTS(
            **({"voice_id": os.environ["FISH_VOICE_ID"]}
               if os.getenv("FISH_VOICE_ID") else {})
        ),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=CollectorAgent(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        ),
    )

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/models/avatar/
    # avatar = anam.AvatarSession(
    #     persona_config=anam.PersonaConfig(
    #         name="...",
    #         avatarId="...",  # See https://docs.livekit.io/agents/models/avatar/plugins/anam
    #     ),
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    # Join the room and connect to the user
    await ctx.connect()

    # Greet the user proactively as a debt collector
    await session.generate_reply(
        instructions=(
            "Greet the debtor: 'Hi, this is Alex from Acme Finance. "
            "I'm calling about your overdue account. Is now a good time to talk?'"
        )
    )


if __name__ == "__main__":
    cli.run_app(server)
