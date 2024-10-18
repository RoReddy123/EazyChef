import { View, Text, FlatList } from 'react-native'
import React, { useEffect, useState} from 'react'
import { collection, query, getDocs } from 'firebase/firestore'
import { db } from '../configs/FirebaseConfig'
import CategoryItem from './CategoryItem'


export default function Category() {
    
    const [categoryList,setCategoryList]=useState([]);
    useEffect(()=>{
        GetCategoryList()
    },[])
    const GetCategoryList=async()=>{
        setCategoryList([])
        const q=query(collection(db,'Category'));
        const querySnapshot=await getDocs(q);

        querySnapshot.forEach((doc)=>{
            console.log(doc.data());
            setCategoryList(prev=>[...prev,doc.data()])
        })
    }

    return (
        <View>
            <View style={{display:'flex',
            flexDirection:'row', justifyContent:'space-between',
            marginTop:1}}>
            <Text 
            style={{paddingLeft: 20,
            fontSize:20,
            marginBottom: 15,
            fontFamily:'outfit-bold'}}>
                Category
                </Text >
                
  
            </View>
            <FlatList
                data={categoryList}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                style={{paddingHorizontal: 20}}
                renderItem={({item,index})=>{
                    return (
                        <CategoryItem 
                        category={item} 
                        key={index}
                        onCategoryPress={(category)=>console.log(category)}
                    />
                    );
                }}
            />
        </View>
    )
}