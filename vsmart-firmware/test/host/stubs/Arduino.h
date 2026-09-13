#pragma once
#include <cstdint>
#include <cstddef>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <ctime>
#include <string>
#include <algorithm>
using byte = uint8_t;
constexpr double PI=3.14159265358979323846, TWO_PI=2*PI;
inline double radians(double x){return x*PI/180;}
inline double degrees(double x){return x*180/PI;}
inline double sq(double x){return x*x;}
extern unsigned long fakeMillis;
inline unsigned long millis(){return fakeMillis;}
#define SERIAL_8N1 0
struct HardwareSerial {
 inline static std::string input;
 HardwareSerial(int=0){}
 void begin(uint32_t,int,int,int){}
 void updateBaudRate(uint32_t){}
 void setRxBufferSize(size_t){}
 int available(){return input.size();}
 int read(){char c=input.front();input.erase(0,1);return (unsigned char)c;}
 template<class... T> void printf(const char*,T...){}
 void write(char){}
};
inline HardwareSerial Serial;
struct FakeEsp { unsigned getFreeHeap(){return 200000;} unsigned getMinFreeHeap(){return 180000;} unsigned getMaxAllocHeap(){return 160000;} };
inline FakeEsp ESP;
