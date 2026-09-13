#pragma once
#include <string>
#include <vector>
struct CloudStub {
 bool online=true;
 std::vector<std::string> payloads,topics;
 bool ready()const{return online;}
 int rssiDbm(){return -50;}
 bool timeSynced(){return true;}
 unsigned consecutiveFailures(){return 0;}
 bool publish(const char* topic,const char* data){if(!online)return false; topics.push_back(topic);payloads.push_back(data);return true;}
};
extern CloudStub Cloud;
