package com.example.server.controller;

import com.example.server.dto.SchoolDto.*;
import com.example.server.service.SchoolService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/school")
public class SchoolController {
    private final SchoolService schoolService;

    public SchoolController(SchoolService schoolService) {
        this.schoolService = schoolService;
    }

    @PostMapping("/list")
    public ResponseEntity<ListSchoolsResponse> listSchools(@RequestBody ListSchoolsRequest req) {
        try {
            return new ResponseEntity<>(schoolService.listSchools(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/create")
    public ResponseEntity<SchoolItem> createSchool(@RequestBody CreateSchoolRequest req) {
        try {
            return new ResponseEntity<>(schoolService.createSchool(req), HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/update")
    public ResponseEntity<SchoolItem> updateSchool(@RequestBody UpdateSchoolRequest req) {
        try {
            return new ResponseEntity<>(schoolService.updateSchool(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping("/delete")
    public ResponseEntity<SuccessResponse> deleteSchool(@RequestBody DeleteSchoolRequest req) {
        try {
            schoolService.deleteSchool(req);
            return new ResponseEntity<>(new SuccessResponse(true), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/class/list")
    public ResponseEntity<ListClassesResponse> listClasses(@RequestBody ListClassesRequest req) {
        try {
            return new ResponseEntity<>(schoolService.listClasses(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/class/create")
    public ResponseEntity<ClassInfoItem> createClass(@RequestBody CreateClassRequest req) {
        try {
            return new ResponseEntity<>(schoolService.createClass(req), HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/class/update")
    public ResponseEntity<ClassInfoItem> updateClass(@RequestBody UpdateClassRequest req) {
        try {
            return new ResponseEntity<>(schoolService.updateClass(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping("/class/delete")
    public ResponseEntity<SuccessResponse> deleteClass(@RequestBody DeleteClassRequest req) {
        try {
            schoolService.deleteClass(req);
            return new ResponseEntity<>(new SuccessResponse(true), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/student/list")
    public ResponseEntity<ListStudentsResponse> listStudents(@RequestBody ListStudentsRequest req) {
        try {
            return new ResponseEntity<>(schoolService.listStudents(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/student/create")
    public ResponseEntity<StudentItem> createStudent(@RequestBody CreateStudentRequest req) {
        try {
            return new ResponseEntity<>(schoolService.createStudent(req), HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/student/delete")
    public ResponseEntity<SuccessResponse> deleteStudent(@RequestBody DeleteStudentRequest req) {
        try {
            schoolService.deleteStudent(req);
            return new ResponseEntity<>(new SuccessResponse(true), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/teacher/classes")
    public ResponseEntity<ListTeacherClassesResponse> listTeacherClasses(@RequestBody ListTeacherClassesRequest req) {
        try {
            return new ResponseEntity<>(schoolService.listTeacherClasses(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/teacher/eyesight/list")
    public ResponseEntity<ListTeacherEyeSightResponse> listTeacherEyeSight(@RequestBody ListTeacherEyeSightRequest req) {
        try {
            return new ResponseEntity<>(schoolService.listTeacherEyeSight(req), HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }
}
