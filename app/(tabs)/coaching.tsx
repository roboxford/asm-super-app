import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import * as MailComposer from 'expo-mail-composer';
import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ PASTE YOUR KEY HERE
const API_KEY = "AIzaSyA_T0L7AQOa1aAJyj4wsRsGS0968jxt9w8"; 
const genAI = new GoogleGenerativeAI(API_KEY);

export default function CoachingScreen() {
  const params = useLocalSearchParams();
  
  const [rawNotes, setRawNotes] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [pdfAttachment, setPdfAttachment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- LISTENER ---
  useEffect(() => {
    if (params.autoFill) {
      setRawNotes(params.autoFill as string);
    }
    if (params.attachment) {
      setPdfAttachment(params.attachment as string);
    }
  }, [params.autoFill, params.attachment]);

  const handleGenerate = async () => {
    if (!rawNotes.trim()) {
      Alert.alert("Input Needed", "Please enter some notes first.");
      return;
    }

    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `
      You are an Assistant Store Manager at Lowe's. 
      Write a professional, developmental email based on the following notes.
      TONE: Professional, Constructive, and Direct.
      NOTES: ${rawNotes}
      REQUIREMENTS: Fix grammar, use paragraphs, clear Call to Action.
      `;
      
      const result = await model.generateContent(prompt);
      setGeneratedEmail(result.response.text());
    } catch (error) {
      Alert.alert("Error", "Failed to generate email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!generatedEmail) return;

    const isAvailable = await MailComposer.isAvailableAsync();
    
    if (isAvailable) {
      MailComposer.composeAsync({
        subject: "Follow-up: Store Walk / Training Recap",
        body: generatedEmail,
        attachments: pdfAttachment ? [pdfAttachment] : [], // Attach the PDF if it exists
      });
    } else {
      Alert.alert("Error", "Email app not available on this device.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          
          <Text style={styles.headerTitle}>Developmental Coach</Text>
          
          {pdfAttachment && (
            <View style={styles.attachmentBadge}>
               <FontAwesome name="file-pdf-o" size={16} color="#d9534f" />
               <Text style={styles.attachmentText}> PDF Report Attached</Text>
            </View>
          )}

          {/* INPUT SECTION */}
          <View style={styles.card}>
            <Text style={styles.label}>1. Raw Notes / Context</Text>
            <TextInput
              style={styles.input}
              value={rawNotes}
              onChangeText={setRawNotes}
              multiline
            />
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate Email</Text>}
            </TouchableOpacity>
          </View>

          {/* OUTPUT SECTION */}
          {generatedEmail ? (
            <View style={[styles.card, { marginTop: 20, borderColor: '#28a745', borderWidth: 1 }]}>
              <Text style={styles.label}>2. AI Draft (Editable)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#f0fff4', height: 250 }]}
                value={generatedEmail}
                onChangeText={setGeneratedEmail}
                multiline
              />
              <TouchableOpacity style={styles.emailBtn} onPress={handleSendEmail}>
                <FontAwesome name="send" size={20} color="#fff" />
                <Text style={styles.btnText}> Open Mail App</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#004990', marginBottom: 10 },
  attachmentBadge: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: '#ffeeba', padding: 8, borderRadius: 5, marginBottom: 15 },
  attachmentText: { color: '#856404', fontWeight: 'bold', marginLeft: 5 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, height: 150, fontSize: 16, marginBottom: 15, textAlignVertical: 'top' },
  generateBtn: { backgroundColor: '#004990', padding: 15, borderRadius: 8, alignItems: 'center' },
  emailBtn: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
});