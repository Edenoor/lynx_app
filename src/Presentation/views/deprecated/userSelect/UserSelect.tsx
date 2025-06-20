import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import styles from './Styles'

type Props = {
  onSelect: (userType: 'DRIVER' | 'SELLER') => void;
};

export const UserTypeSelectionScreen = ({ onSelect }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Role</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => onSelect('DRIVER')}
      >
        <Text style={styles.buttonText}>I'm a Driver</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.sellerButton]}
        onPress={() => onSelect('SELLER')}
      >
        <Text style={styles.buttonText}>I'm a Seller</Text>
      </TouchableOpacity>
    </View>
  );
};


