import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, Modal, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext, WorklistGroup } from '../../context/AppContext';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function OperationsScreen() {
  const { 
    worklistGroups, 
    addWorklistGroup, 
    deleteWorklistGroup, 
    renameWorklistGroup 
  } = useAppContext();
  
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // --- CREATE NEW LIST ---
  const handleAddGroup = () => {
    if (!currentName.trim()) return;
    addWorklistGroup(currentName);
    setCurrentName('');
    setModalVisible(false);
  };

  // --- RENAME LOGIC ---
  const openRenameModal = (group: WorklistGroup) => {
    setSelectedGroupId(group.id);
    setCurrentName(group.name);
    setRenameModalVisible(true);
  };

  const handleRename = () => {
    if (selectedGroupId && currentName.trim()) {
      renameWorklistGroup(selectedGroupId, currentName);
      setRenameModalVisible(false);
      setCurrentName('');
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<WorklistGroup>) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[styles.card, isActive && styles.cardActive]}
          onPress={() => router.push(`/worklist/${item.id}`)}
          onLongPress={drag}
          disabled={isActive}
        >
          <View style={styles.cardContent}>
            <FontAwesome name="clipboard" size={24} color="#004990" />
            <Text style={styles.cardTitle}>{item.name}</Text>
          </View>

          <View style={styles.actions}>
            {/* Rename Button */}
            <TouchableOpacity onPress={() => openRenameModal(item)} style={styles.actionBtn}>
              <FontAwesome name="pencil" size={20} color="#666" />
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity 
              onPress={() => Alert.alert(
                "Delete List?", 
                "This will delete all items in this list.",
                [{ text: "Cancel" }, { text: "Delete", style: 'destructive', onPress: () => deleteWorklistGroup(item.id) }]
              )} 
              style={styles.actionBtn}
            >
              <FontAwesome name="trash-o" size={20} color="#dc3545" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Worklists</Text>
          <TouchableOpacity onPress={() => { setCurrentName(''); setModalVisible(true); }}>
            <FontAwesome name="plus-circle" size={32} color="#004990" />
          </TouchableOpacity>
        </View>

        <DraggableFlatList
          data={worklistGroups}
          onDragEnd={({ data }) => console.log('Reordered')} // In a real app, update context order
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No active lists. Tap + to start a walk.</Text>
          }
        />

        {/* --- CREATE MODAL --- */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Worklist</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Lumber Recovery..." 
                value={currentName}
                onChangeText={setCurrentName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddGroup} style={styles.confirmBtn}>
                  <Text style={{color:'#fff'}}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- RENAME MODAL --- */}
        <Modal visible={renameModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename List</Text>
              <TextInput 
                style={styles.input} 
                value={currentName}
                onChangeText={setCurrentName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={styles.cancelBtn}>
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRename} style={styles.confirmBtn}>
                  <Text style={{color:'#fff'}}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' 
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  
  card: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 20, marginBottom: 10, borderRadius: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  cardActive: { backgroundColor: '#e6f0ff', transform: [{ scale: 1.02 }] },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '500', marginLeft: 15, color: '#333' },
  
  actions: { flexDirection: 'row' },
  actionBtn: { padding: 10, marginLeft: 5 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  confirmBtn: { flex: 1, backgroundColor: '#004990', padding: 15, borderRadius: 8, alignItems: 'center' },
});