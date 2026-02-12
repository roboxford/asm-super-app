import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, Keyboard, SectionList, Modal, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../context/AppContext';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker'; // ADDED FOR CAMERA
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';

// ⚠️ PASTE YOUR API KEY HERE
const API_KEY = "AIzaSyA_T0L7AQOa1aAJyj4wsRsGS0968jxt9w8"; 
const genAI = new GoogleGenerativeAI(API_KEY);

export default function TrainingScreen() {
  const { 
    roster, trainingQueue, dailyPlan, planTimestamp, setDailyPlan,
    addTrainingToAssociate, removeAssociate, markTaskComplete, toggleSpokenStatus 
  } = useAppContext();

  const router = useRouter();

  // Manual Input State
  const [currentName, setCurrentName] = useState('');
  const [filteredRoster, setFilteredRoster] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]); 
  const [workdayInput, setWorkdayInput] = useState('');
  const [workdayCourses, setWorkdayCourses] = useState([]);

  // Import/Scan State (NEW)
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importImage, setImportImage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // Schedule State
  const [selectedFile, setSelectedFile] = useState(null); 
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // --- 1. SMART IMPORT LOGIC (NEW) ---
  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setImportImage(result.assets[0].base64);
    }
  };

  const processTrainingImport = async () => {
    if (!importText && !importImage) return Alert.alert("Empty", "Please paste text or snap a photo.");
    setIsImporting(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const prompt = `
        I have a training report (text or image). 
        1. Extract the Associate Names and their MISSING training tasks.
        2. Match the extracted names to this Official Roster: ${JSON.stringify(roster)}.
        3. If a name resembles someone on the roster (e.g., "Doe, J" -> "John Do"), use the Official Roster name.
        4. Return a JSON LIST: [{ "name": "Official Name", "tasks": ["AP4Me", "HazMat"] }]
        
        Raw Text Context (if any): "${importText}"
      `;

      const parts = [{ text: prompt }];
      if (importImage) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: importImage } });
      }

      const result = await model.generateContent(parts);
      const response = await result.response;
      const cleanJson = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      if (Array.isArray(parsedData)) {
        parsedData.forEach(item => {
          if (item.name && item.tasks && item.tasks.length > 0) {
            addTrainingToAssociate(item.name, item.tasks);
          }
        });
        Alert.alert("Success", `Imported ${parsedData.length} associates.`);
        setImportModalVisible(false);
        setImportText('');
        setImportImage(null);
      } else {
        Alert.alert("Error", "Could not read data. Try again.");
      }

    } catch (e) {
      Alert.alert("Error", "AI Scan failed. Please try again.");
      console.log(e);
    } finally {
      setIsImporting(false);
    }
  };

  // --- 2. MANUAL ADD LOGIC ---
  const handleNameChange = (text) => {
    setCurrentName(text);
    if (text.length > 0) {
      setFilteredRoster(roster.filter(name => name.toLowerCase().includes(text.toLowerCase())));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectName = (name) => {
    setCurrentName(name);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const addWorkdayCourse = () => {
    if (!workdayInput.trim()) return;
    setWorkdayCourses([...workdayCourses, workdayInput.trim()]);
    setWorkdayInput(''); 
  };

  const handleAddPerson = () => {
    const nameTrimmed = currentName.trim();
    if (!nameTrimmed) return Alert.alert("Missing Name", "Please enter a name.");
    let tasks = selectedTypes.filter(t => t !== 'Workday');
    if (selectedTypes.includes('Workday')) {
      tasks = [...tasks, ...workdayCourses.map(c => `Workday: ${c}`)];
    }
    if (tasks.length === 0) return Alert.alert("Missing Training", "Select at least one type.");
    addTrainingToAssociate(nameTrimmed, tasks);
    setCurrentName(''); setSelectedTypes([]); setWorkdayCourses([]); setShowSuggestions(false);
  };

  // --- 3. FORMAT DATE HELPER ---
  const formatSpokenTime = (isoString) => {
    if (!isoString) return null;
    return new Date(isoString).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  // --- 4. SCHEDULE PROCESSING ---
  const processSchedule = async () => {
    const activeQueue = trainingQueue.filter(i => i.status !== 'completed');
    if (activeQueue.length === 0) return Alert.alert("All Done!", "Everyone is marked complete.");
    if (!selectedFile) return Alert.alert("Missing Schedule", "Please upload a schedule.");
    setLoading(true);
    try {
      const todayMatchStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }); 
      const todayFullStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      const base64Data = await FileSystem.readAsStringAsync(selectedFile.uri, { encoding: 'base64' });
      
      const prompt = `
        Context: ASM Store Manager tool.
        Current Date: ${todayFullStr}
        Target Date Header: "${todayMatchStr}" (This is TODAY).
        Task: Find "TODAY" column. For each name, find row. If time exists, KEEP IT. If OFF/VAC/Empty -> Check TOMORROW.
        Return JSON: [{"name", "dayDate", "shiftTime", "endTime24"}]
        List: ${JSON.stringify(activeQueue.map(a => a.name))}
      `;

      const result = await model.generateContent([{ text: prompt }, { inlineData: { data: base64Data, mimeType: 'application/pdf' } }]);
      const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const rawShifts = JSON.parse(cleanJson);
      
      const groupedData = rawShifts.reduce((acc, current) => {
        const group = acc.find(g => g.title === current.dayDate);
        if (group) group.data.push(current); else acc.push({ title: current.dayDate, data: [current] });
        return acc;
      }, []);

      groupedData.forEach(g => g.data.sort((a, b) => (a.endTime24 || 9999) - (b.endTime24 || 9999)));
      groupedData.sort((a, b) => a.title.includes(todayMatchStr.split('/')[1]) ? -1 : 1);

      setDailyPlan(groupedData, new Date().toLocaleString());
      setSelectedFile(null);
    } catch (error) { Alert.alert("Error", "Schedule analysis failed."); }
    finally { setLoading(false); }
  };

  const escalateToCoaching = (associate) => {
    const missing = associate.tasks.filter(t => !t.completed).map(t => t.name).join(', ');
    const note = `I spoke with ${associate.name} today regarding: ${missing}. They committed to finishing it by end of shift.`;
    router.push({ pathname: '/(tabs)/coaching', params: { autoFill: note } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* HEADER WITH IMPORT BUTTON */}
            <View style={styles.headerRow}>
              <Text style={styles.screenTitle}>Training Tracker</Text>
              <TouchableOpacity style={styles.importBtn} onPress={() => setImportModalVisible(true)}>
                <FontAwesome name="camera" size={20} color="#fff" />
                <Text style={styles.importBtnText}> Scan</Text>
              </TouchableOpacity>
            </View>

            {/* 1. ADD ASSOCIATE CARD */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Manual Add</Text>
              <TextInput style={styles.input} placeholder="Type name..." value={currentName} onChangeText={handleNameChange} />
              {showSuggestions && filteredRoster.length > 0 && (
                <View style={styles.suggestionBox}>
                  {filteredRoster.slice(0, 5).map(name => (
                    <TouchableOpacity key={name} style={styles.suggestionItem} onPress={() => selectName(name)}><Text style={styles.suggestionText}>{name}</Text></TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.typeRow}>
                {['AP4Me', 'LowesU', 'Workday'].map(type => (
                  <TouchableOpacity key={type} style={[styles.typeButton, selectedTypes.includes(type) && styles.typeButtonActive]} onPress={() => toggleType(type)}>
                    <Text style={[styles.typeText, selectedTypes.includes(type) && styles.typeTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {selectedTypes.includes('Workday') && (
                <View style={styles.workdayContainer}>
                  <View style={{flexDirection: 'row'}}>
                    <TextInput style={[styles.input, {flex:1, borderColor:'#F96302'}]} placeholder="Course Name" value={workdayInput} onChangeText={setWorkdayInput} />
                    <TouchableOpacity style={styles.addCourseButton} onPress={() => { if(workdayInput) setWorkdayCourses([...workdayCourses, workdayInput]); setWorkdayInput(''); }}><Text style={{color:'#fff', fontSize:24}}>+</Text></TouchableOpacity>
                  </View>
                  <View style={styles.courseTagsContainer}>
                    {workdayCourses.map((c, i) => <View key={i} style={styles.courseTag}><Text style={styles.courseTagText}>{c}</Text></View>)}
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.addButton} onPress={handleAddPerson}><Text style={styles.addButtonText}>+ Add to List</Text></TouchableOpacity>
            </View>

            {/* 2. TO-DO LIST */}
            <Text style={styles.sectionTitle}>To-Do List</Text>
            {trainingQueue.filter(a => a.status !== 'completed').map(item => {
              const isSpoken = !!item.lastSpokenTo;
              const spokenTime = formatSpokenTime(item.lastSpokenTo);
              return (
                <View key={item.id} style={[styles.queueItem, isSpoken && styles.queueItemSpoken]}>
                  <TouchableOpacity onPress={() => removeAssociate(item.id)} style={{marginRight:10}}><Ionicons name="close-circle" size={26} color="#dc3545" /></TouchableOpacity>
                  <View style={{flex:1}}>
                     <Text style={styles.queueName}>{item.name}</Text>
                     {isSpoken && <View style={styles.timestampBadge}><Text style={styles.timestampText}>Spoke: {spokenTime}</Text></View>}
                     {item.tasks.map(t => (
                        <TouchableOpacity key={t.id} style={styles.taskRow} onPress={() => markTaskComplete(item.id, t.id)}>
                           <Ionicons name={t.completed ? "checkbox" : "square-outline"} size={22} color={isSpoken ? "#2e7d32" : "#004990"} />
                           <Text style={[styles.taskText, t.completed && {textDecorationLine:'line-through', color:'#aaa'}]}> {t.name}</Text>
                        </TouchableOpacity>
                     ))}
                  </View>
                  <View style={{alignItems:'center'}}>
                    <TouchableOpacity onPress={() => toggleSpokenStatus(item.id)} style={{marginBottom: 10}}>
                       <MaterialIcons name="record-voice-over" size={28} color={item.lastSpokenTo ? "#28a745" : "#ccc"} />
                    </TouchableOpacity>
                    {isSpoken && <TouchableOpacity onPress={() => escalateToCoaching(item)}><MaterialIcons name="email" size={28} color="#004990" /></TouchableOpacity>}
                  </View>
                </View>
              );
            })}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>3. Build Daily Plan</Text>
            {planTimestamp && <Text style={styles.timestampText}>Generated: {planTimestamp}</Text>}
            <TouchableOpacity style={styles.uploadButton} onPress={async () => {
              const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
              if (res.assets) setSelectedFile(res.assets[0]);
            }}><Text style={styles.uploadButtonText}>{selectedFile ? selectedFile.name : "Upload Schedule PDF"}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.runButton} onPress={processSchedule} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.runButtonText}>Process Schedule</Text>}</TouchableOpacity>
            {dailyPlan && <TextInput style={styles.input} placeholder="🔍 Filter Plan..." value={scheduleSearch} onChangeText={setScheduleSearch} />}
          </>
        }
        sections={dailyPlan?.map(s => ({ ...s, data: s.data.filter(i => i.name.toLowerCase().includes(scheduleSearch.toLowerCase())) })).filter(s => s.data.length > 0) || []}
        keyExtractor={(item, index) => item.name + index}
        renderSectionHeader={({ section: { title } }) => <View style={styles.dayHeader}><Text style={styles.dayTitle}>{title}</Text></View>}
        renderItem={({ item }) => {
            const assoc = trainingQueue.find(a => a.name === item.name);
            const isSpoken = !!assoc?.lastSpokenTo;
            const spokenTime = formatSpokenTime(assoc?.lastSpokenTo);
            return (
                <TouchableOpacity 
                  style={[styles.resultCard, isSpoken && styles.resultCardSpoken]}
                  activeOpacity={0.8}
                  onPress={() => assoc && toggleSpokenStatus(assoc.id)}
                >
                    <View style={{flex:1}}>
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                            <Text style={styles.resultName}>{item.name}</Text>
                            <Text style={styles.leaveTime}>Leaves: {item.shiftTime.split('-')[1] || '?'}</Text>
                        </View>
                        <Text style={styles.resultTime}>{item.shiftTime}</Text>
                        {isSpoken && <View style={styles.timestampBadge}><Text style={styles.timestampText}>Spoke: {spokenTime}</Text></View>}
                        {assoc?.tasks.map(t => (
                           <TouchableOpacity key={t.id} style={{flexDirection:'row', alignItems:'center', marginTop:8}} onPress={() => markTaskComplete(assoc.id, t.id)}>
                              <Ionicons name={t.completed ? "checkbox" : "square-outline"} size={22} color={isSpoken ? "#2e7d32" : "#004990"} />
                              <Text style={[styles.taskText, t.completed && {textDecorationLine:'line-through', color:'#aaa'}]}> {t.name}</Text>
                           </TouchableOpacity>
                        ))}
                    </View>
                    {isSpoken && <TouchableOpacity onPress={() => escalateToCoaching(assoc)} style={{justifyContent:'center', paddingLeft:10}}><MaterialIcons name="email" size={30} color="#004990" /></TouchableOpacity>}
                </TouchableOpacity>
            );
        }}
        ListFooterComponent={dailyPlan && <TouchableOpacity style={{margin:20, alignItems:'center'}} onPress={() => setDailyPlan(null)}><Text style={{color:'#666'}}>Clear Plan</Text></TouchableOpacity>}
      />

      {/* IMPORT MODAL */}
      <Modal visible={importModalVisible} animationType="slide">
        <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
          <View style={{padding:20, flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={{fontSize:24, fontWeight:'bold'}}>Smart Import</Text>
            <TouchableOpacity onPress={() => setImportModalVisible(false)}><Text style={{fontSize:18, color:'blue'}}>Close</Text></TouchableOpacity>
          </View>
          <View style={{padding:20}}>
            <Text style={{marginBottom:10, color:'#666'}}>1. Paste text from email OR snap a photo.</Text>
            <TextInput 
              style={{borderWidth:1, borderColor:'#ddd', height:100, padding:10, borderRadius:8, marginBottom:20}} 
              multiline 
              placeholder="Paste training report text here..." 
              value={importText} 
              onChangeText={setImportText} 
            />
            <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
              <FontAwesome name="camera" size={24} color="#004990" />
              <Text style={{marginLeft:10, color:'#004990', fontWeight:'bold', fontSize:16}}>
                {importImage ? "Image Selected" : "Take Photo of Report"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.processImportBtn} onPress={processTrainingImport} disabled={isImporting}>
              {isImporting ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'bold', fontSize:18}}>Run AI Scan</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#004990' },
  importBtn: { flexDirection: 'row', backgroundColor: '#004990', padding: 8, borderRadius: 8, alignItems: 'center' },
  importBtnText: { color: '#fff', fontWeight: 'bold' },
  
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, elevation: 2, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  input: { backgroundColor: '#F9F9F9', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', fontSize: 16, marginBottom: 10 },
  suggestionBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionText: { fontSize: 16, color: '#333' },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#004990', borderRadius: 6, marginHorizontal: 3 },
  typeButtonActive: { backgroundColor: '#004990' },
  typeText: { color: '#004990', fontWeight: '600' },
  typeTextActive: { color: '#fff' },
  workdayContainer: { marginTop: 15, padding: 10, backgroundColor: '#FFF5E5', borderRadius: 8, borderWidth: 1, borderColor: '#F96302' },
  addCourseButton: { backgroundColor: '#F96302', width: 45, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  courseTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  courseTag: { backgroundColor: '#fff', padding: 6, borderRadius: 4, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: '#F96302' },
  courseTagText: { color: '#D95300', fontSize: 12, fontWeight: 'bold' },
  addButton: { backgroundColor: '#004990', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 8, borderLeftWidth: 5, borderLeftColor: '#004990' },
  queueItemSpoken: { backgroundColor: '#e6ffe6', borderLeftColor: '#28a745' },
  queueName: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  taskRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  taskText: { fontSize: 15, marginLeft: 8, color: '#333' },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 20 },
  uploadButton: { backgroundColor: '#E1EBF5', padding: 15, borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#004990', alignItems: 'center' },
  uploadButtonText: { color: '#004990', fontWeight: 'bold' },
  runButton: { backgroundColor: '#004990', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  runButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  timestampText: { fontSize: 12, color: '#888', marginBottom: 10, fontStyle: 'italic' },
  dayHeader: { backgroundColor: '#004990', padding: 10, borderRadius: 6, marginTop: 15 },
  dayTitle: { color: '#fff', fontWeight: 'bold' },
  resultCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginTop: 10, borderLeftWidth: 6, borderLeftColor: '#F96302', flexDirection: 'row', elevation: 2 },
  resultCardSpoken: { backgroundColor: '#e6ffe6', borderLeftColor: '#28a745' }, 
  resultName: { fontSize: 18, fontWeight: 'bold' },
  leaveTime: { color: '#D95300', fontWeight: 'bold' },
  resultTime: { color: '#555' },
  timestampBadge: { backgroundColor: '#28a745', alignSelf:'flex-start', paddingHorizontal:6, paddingVertical:2, borderRadius:4, marginVertical:4 },
  
  // MODAL STYLES
  cameraBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderWidth: 1, borderColor: '#004990', borderRadius: 8, borderStyle: 'dashed', marginBottom: 20 },
  processImportBtn: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center' }
});