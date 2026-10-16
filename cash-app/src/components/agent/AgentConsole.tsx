import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Text, TextInput } from "react-native-paper";

const environment = process.env as Record<string, string | undefined>;
const API_BASE = environment.EXPO_PUBLIC_AGENT_API_URL ?? "";

export function AgentConsole() {
  const [prompt, setPrompt] = useState("Run this calculation safely in the E2B sandbox");
  const [code, setCode] = useState("numbers = [2, 4, 6, 8]\nprint({\"count\": len(numbers), \"sum\": sum(numbers)})");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runTask() {
    setBusy(true);
    setMessage("Planning task and opening an isolated E2B sandbox…");
    setOutput([]);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, code, language: "python" }),
      });
      const payload = (await response.json()) as {
        taskId?: string;
        result?: { ok: boolean; stdout: string[]; stderr: string[]; error?: { traceback: string } };
        error?: string;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "The agent request failed");
      }
      setMessage(payload.result.ok ? `Completed · task ${payload.taskId ?? "saved"}` : "Execution returned an error");
      setOutput([...payload.result.stdout, ...payload.result.stderr]);
      if (payload.result.error) setError(payload.result.error.traceback);
    } catch (cause) {
      setMessage("Request failed");
      setError(cause instanceof Error ? cause.message : "Unknown request error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card} mode="contained">
      <Card.Content>
        <View style={styles.header}>
          <View>
            <Text variant="titleLarge" style={styles.title}>Agent execution</Text>
            <Text style={styles.subtitle}>Neon history · E2B isolated runtime</Text>
          </View>
          <Chip compact icon="shield-check">Live</Chip>
        </View>
        <TextInput
          label="Task"
          value={prompt}
          onChangeText={setPrompt}
          mode="outlined"
          style={styles.input}
          textColor="#f8fafc"
        />
        <TextInput
          label="Python to execute"
          value={code}
          onChangeText={setCode}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={[styles.input, styles.code]}
          textColor="#f8fafc"
          autoCapitalize="none"
        />
        <Button mode="contained" loading={busy} disabled={busy || !prompt.trim() || !code.trim()} onPress={runTask} buttonColor="#8b5cf6">
          Run in E2B
        </Button>
        <Text style={styles.status}>{message}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {output.length > 0 ? (
          <ScrollView style={styles.output} contentContainerStyle={styles.outputContent}>
            {output.map((line, index) => <Text key={`${index}-${line}`} style={styles.outputText}>{line}</Text>)}
          </ScrollView>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, backgroundColor: "#171b24", borderRadius: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { color: "#f8fafc", fontWeight: "700" },
  subtitle: { color: "#94a3b8", marginTop: 3 },
  input: { marginBottom: 12, backgroundColor: "#202633" },
  code: { minHeight: 112 },
  status: { color: "#a5b4fc", marginTop: 14 },
  error: { color: "#fca5a5", marginTop: 10, fontFamily: "monospace" },
  output: { maxHeight: 140, marginTop: 12, backgroundColor: "#0b1020", borderRadius: 10 },
  outputContent: { padding: 12 },
  outputText: { color: "#86efac", fontFamily: "monospace", marginBottom: 3 },
});
