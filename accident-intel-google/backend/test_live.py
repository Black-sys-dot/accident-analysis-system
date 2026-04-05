import asyncio
import os
from dotenv import load_dotenv

# Load workspace root .env if it exists
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

from google import genai
from google.genai import types

async def main():
    api_key = os.getenv('GEMINI_API_KEY')
    print(f"API Key found: {'Yes' if api_key else 'No'}")
    client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    config = types.LiveConnectConfig(
        response_modalities=['AUDIO'],
        system_instruction='Call the scenario_showSummerHeatmap tool.',
        tools=[{'function_declarations': [{'name': 'scenario_showSummerHeatmap', 'description': 'do something'}]}]
    )
    try:
        async with client.aio.live.connect(model='gemini-2.5-flash-native-audio-preview-12-2025', config=config) as session:
            print("Connected.")
            await session.send_client_content(turns={'role': 'user', 'parts': [{'text': 'Show summer heatmap'}]}, turn_complete=True)
            print("Sent request.")
            
            while True:
                async for msg in session.receive():
                    print("\n--- NEW MESSAGE ---")
                    tool_call = getattr(msg, 'tool_call', None)
                    if tool_call and tool_call.function_calls:
                        print(f"TOOL CALL: {tool_call.function_calls[0].name}")
                        await session.send_tool_response(function_responses=[{
                            'id': tool_call.function_calls[0].id, 
                            'name': tool_call.function_calls[0].name, 
                            'response': {'ok': True}
                        }])
                        print("Sent tool response.")
                    
                    server_content = getattr(msg, 'server_content', None)
                    model_turn = getattr(server_content, 'model_turn', None) if server_content else None
                    if model_turn and model_turn.parts:
                        for p in model_turn.parts:
                            if p.text:
                                print(f"TEXT: {p.text}")
                            elif p.inline_data:
                                print(f"AUDIO CHUNK: {len(p.inline_data.data)} bytes")
                    
                    if getattr(server_content, 'turn_complete', False):
                        print("TURN COMPLETE")
                        return
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())